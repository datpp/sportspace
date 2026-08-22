import * as fs from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourtStatus, Role, VenueStatus } from '@sportspace/shared';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FindVenuesQueryDto } from './dto/find-venues-query.dto';
import { AdminVenuesQueryDto } from './dto/admin-venues-query.dto';
import { MerchantVenuesQueryDto } from './dto/merchant-venues-query.dto';
import { Venue } from './entities/venue.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';
import { VENUE_UPLOADS_DIR } from './venue-uploads.constants';
import { RedisService } from '../redis/redis.service';

const MAX_VENUE_IMAGES = 8;
const IMAGES_LOCK_TTL_SECONDS = 10;

// Extension is derived from the already-validated mimetype, never from
// `file.originalname` — the two are independently attacker-controlled in
// the same multipart part, so trusting originalname's extension lets a
// `Content-Type: image/jpeg` upload with `filename="payload.html"` get
// served back by express.static as text/html (stored XSS).
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class VenueService {
  constructor(
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    private readonly redisService: RedisService,
  ) {}

  create(ownerId: string, dto: CreateVenueDto): Promise<Venue> {
    const venue = this.venueRepo.create({
      ...dto,
      owner: { id: ownerId } as User,
    });
    return this.venueRepo.save(venue);
  }

  //
  // Deliberately does NOT .leftJoinAndSelect('venue.courts', 'courts'):
  // neither the merchant nor admin venues list UI reads `venue.courts`,
  // so it's dropped to keep this query lighter. (This is NOT a
  // correctness fix — the project's TypeORM version already protects a
  // joined one-to-many + .skip()/.take() query from fan-out via a
  // two-step distinct-ID-then-hydrate query. Drop it for cost, not
  // because leaving it in would paginate incorrectly.)
  async findByOwner(
    ownerId: string,
    query: MerchantVenuesQueryDto,
  ): Promise<PaginatedDto<Venue>> {
    const { page, limit, q } = query;

    const qb = this.venueRepo
      .createQueryBuilder('venue')
      .where('venue.owner = :ownerId', { ownerId })
      .orderBy('venue.createdAt', 'DESC');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('venue.status = :status', { status: query.status });
    }
    if (q?.trim()) {
      qb.andWhere('(venue.name ILIKE :q OR venue.address ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findAllForAdmin(
    query: AdminVenuesQueryDto,
  ): Promise<PaginatedDto<Venue>> {
    const { page, limit, q, province } = query;
    const status = query.status ?? VenueStatus.PENDING;

    const qb = this.venueRepo
      .createQueryBuilder('venue')
      .leftJoinAndSelect('venue.owner', 'owner')
      .orderBy('venue.createdAt', 'DESC');

    if (status !== 'ALL') {
      qb.andWhere('venue.status = :status', { status });
    }
    if (q?.trim()) {
      qb.andWhere(
        '(venue.name ILIKE :q OR venue.address ILIKE :q OR owner.fullName ILIKE :q OR owner.email ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }
    if (province?.trim()) {
      qb.andWhere('venue.province = :province', { province: province.trim() });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async listDistinctProvinces(): Promise<string[]> {
    const rows = await this.venueRepo
      .createQueryBuilder('venue')
      .select('DISTINCT venue.province', 'province')
      .where('venue.province IS NOT NULL')
      .orderBy('venue.province', 'ASC')
      .getRawMany<{ province: string }>();
    return rows.map((r) => r.province);
  }

  findAll(query: FindVenuesQueryDto): Promise<Venue[]> {
    const qb = this.venueRepo
      .createQueryBuilder('venue')
      .where('venue.status = :status', { status: VenueStatus.APPROVED });

    if (query.sport) {
      qb.innerJoin(
        'venue.courts',
        'court',
        'court.sport = :sport AND court.status = :courtStatus',
        { sport: query.sport, courtStatus: CourtStatus.ACTIVE },
      ).distinct(true);
    }

    if (query.lat !== undefined && query.lng !== undefined) {
      qb.addSelect(
        `6371 * acos(cos(radians(:lat)) * cos(radians(venue.lat)) * cos(radians(venue.lng) - radians(:lng)) + sin(radians(:lat)) * sin(radians(venue.lat)))`,
        'distance',
      )
        .setParameters({ lat: query.lat, lng: query.lng })
        .orderBy('distance', 'ASC');
    } else {
      qb.orderBy('venue.createdAt', 'DESC');
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Venue> {
    const venue = await this.venueRepo.findOne({
      where: { id },
      relations: { owner: true, courts: true },
    });
    if (!venue) {
      throw new NotFoundException('Cụm sân không tồn tại');
    }
    return venue;
  }

  async update(
    id: string,
    dto: UpdateVenueDto,
    user: AuthenticatedUser,
  ): Promise<Venue> {
    const venue = await this.findOne(id);
    this.assertOwnerOrAdmin(venue, user);
    Object.assign(venue, dto);
    return this.venueRepo.save(venue);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const venue = await this.findOne(id);
    this.assertOwnerOrAdmin(venue, user);
    await this.venueRepo.remove(venue);
  }

  async approve(id: string): Promise<Venue> {
    const venue = await this.findOne(id);
    venue.status = VenueStatus.APPROVED;
    return this.venueRepo.save(venue);
  }

  async reject(id: string): Promise<Venue> {
    const venue = await this.findOne(id);
    venue.status = VenueStatus.REJECTED;
    return this.venueRepo.save(venue);
  }

  async addImage(
    id: string,
    user: AuthenticatedUser,
    file: Express.Multer.File,
  ): Promise<Venue> {
    return this.withImagesLock(id, async () => {
      const venue = await this.findOne(id);
      this.assertOwnerOrAdmin(venue, user);
      if (venue.images.length >= MAX_VENUE_IMAGES) {
        throw new BadRequestException(
          `Cụm sân chỉ được tối đa ${MAX_VENUE_IMAGES} ảnh`,
        );
      }

      await fs.mkdir(VENUE_UPLOADS_DIR, { recursive: true });
      const filename = `${randomUUID()}${EXT_BY_MIME[file.mimetype]}`;
      await fs.writeFile(join(VENUE_UPLOADS_DIR, filename), file.buffer);

      venue.images = [...venue.images, `/uploads/venues/${filename}`];
      return this.venueRepo.save(venue);
    });
  }

  async removeImage(
    id: string,
    user: AuthenticatedUser,
    url: string,
  ): Promise<Venue> {
    return this.withImagesLock(id, async () => {
      const venue = await this.findOne(id);
      this.assertOwnerOrAdmin(venue, user);

      if (!venue.images.includes(url)) {
        throw new NotFoundException('Ảnh không thuộc cụm sân này');
      }

      venue.images = venue.images.filter((img) => img !== url);
      const saved = await this.venueRepo.save(venue);

      const filename = url.split('/').pop();
      if (filename) {
        try {
          await fs.unlink(join(VENUE_UPLOADS_DIR, filename));
        } catch {
          // File already gone from disk — not fatal, the DB record is the
          // source of truth and it's already updated above.
        }
      }

      return saved;
    });
  }

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên cụm sân này',
      );
    }
  }

  // addImage/removeImage are read-modify-write over the whole `images`
  // array — concurrent calls for the same venue must be serialized or the
  // last writer silently drops the others' changes (CLAUDE.md §6 layer-1).
  private async withImagesLock<T>(
    venueId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `lock:venue:${venueId}:images`;
    const lockToken = await this.redisService.acquireLock(
      lockKey,
      IMAGES_LOCK_TTL_SECONDS,
    );
    if (!lockToken) {
      throw new ConflictException(
        'Cụm sân đang được cập nhật ảnh, vui lòng thử lại',
      );
    }

    try {
      return await work();
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }
}
