import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FindVenuesQueryDto } from './dto/find-venues-query.dto';
import { Venue } from './entities/venue.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

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

  findAll(query: FindVenuesQueryDto): Promise<Venue[]> {
    const qb = this.venueRepo.createQueryBuilder('venue');

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

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên cụm sân này',
      );
    }
  }
}
