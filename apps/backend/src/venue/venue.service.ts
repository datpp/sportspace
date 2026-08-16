import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, VenueStatus } from '@sportspace/shared';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FindVenuesQueryDto } from './dto/find-venues-query.dto';
import { AdminVenuesQueryDto } from './dto/admin-venues-query.dto';
import { Venue } from './entities/venue.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';

@Injectable()
export class VenueService {
  constructor(
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
  ) {}

  create(ownerId: string, dto: CreateVenueDto): Promise<Venue> {
    const venue = this.venueRepo.create({
      ...dto,
      owner: { id: ownerId } as User,
    });
    return this.venueRepo.save(venue);
  }

  findByOwner(ownerId: string): Promise<Venue[]> {
    return this.venueRepo.find({
      where: { owner: { id: ownerId } },
      relations: { courts: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForAdmin(
    query: AdminVenuesQueryDto,
  ): Promise<PaginatedDto<Venue>> {
    const { page, limit, q, province } = query;
    const status = query.status ?? VenueStatus.PENDING;

    const qb = this.venueRepo
      .createQueryBuilder('venue')
      .leftJoinAndSelect('venue.owner', 'owner')
      .leftJoinAndSelect('venue.courts', 'courts')
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
      qb.innerJoin('venue.courts', 'court', 'court.sport = :sport', {
        sport: query.sport,
      }).distinct(true);
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

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên cụm sân này',
      );
    }
  }
}
