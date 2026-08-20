import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { BookingStatus, Role } from '@sportspace/shared';
import { Court } from './entities/court.entity';
import { Venue } from './entities/venue.entity';
import { PriceRule } from './entities/price-rule.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { CreatePriceRuleDto } from './dto/create-price-rule.dto';
import { SlotQueryDto } from './dto/slot-query.dto';
import { SlotDto } from './dto/slot.dto';
import { FindCourtsQueryDto } from './dto/find-courts-query.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Booking } from '../booking/entities/booking.entity';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';

const OPERATING_START_HOUR = 6;
const OPERATING_END_HOUR = 22;

@Injectable()
export class CourtService {
  constructor(
    @InjectRepository(Court) private readonly courtRepo: Repository<Court>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCourtDto, user: AuthenticatedUser): Promise<Court> {
    const venue = await this.dataSource.getRepository(Venue).findOne({
      where: { id: dto.venueId },
      relations: { owner: true },
    });
    if (!venue) {
      throw new NotFoundException('Cụm sân không tồn tại');
    }
    this.assertOwnerOrAdmin(venue, user);

    const court = this.courtRepo.create({
      venue,
      name: dto.name,
      sport: dto.sport,
      basePrice: dto.basePrice,
    });
    return this.courtRepo.save(court);
  }

  async findAll(query: FindCourtsQueryDto): Promise<PaginatedDto<Court>> {
    const { page, limit, q, venueId } = query;

    const qb = this.courtRepo
      .createQueryBuilder('court')
      .leftJoinAndSelect('court.venue', 'venue')
      .orderBy('court.name', 'ASC');

    if (venueId) {
      qb.andWhere('venue.id = :venueId', { venueId });
    }
    if (q?.trim()) {
      qb.andWhere('(court.name ILIKE :q OR court.sport ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string): Promise<Court> {
    const court = await this.courtRepo.findOne({
      where: { id },
      relations: { venue: { owner: true }, priceRules: true },
    });
    if (!court) {
      throw new NotFoundException('Sân không tồn tại');
    }
    return court;
  }

  async update(
    id: string,
    dto: UpdateCourtDto,
    user: AuthenticatedUser,
  ): Promise<Court> {
    const court = await this.findOne(id);
    this.assertOwnerOrAdmin(court.venue, user);
    Object.assign(court, dto);
    return this.courtRepo.save(court);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const court = await this.findOne(id);
    this.assertOwnerOrAdmin(court.venue, user);
    await this.courtRepo.remove(court);
  }

  async addPriceRule(
    courtId: string,
    dto: CreatePriceRuleDto,
    user: AuthenticatedUser,
  ): Promise<PriceRule> {
    const court = await this.findOne(courtId);
    this.assertOwnerOrAdmin(court.venue, user);

    const priceRule = this.dataSource
      .getRepository(PriceRule)
      .create({ ...dto, court });
    return this.dataSource.getRepository(PriceRule).save(priceRule);
  }

  async listPriceRules(courtId: string): Promise<PriceRule[]> {
    return this.dataSource
      .getRepository(PriceRule)
      .find({ where: { court: { id: courtId } } });
  }

  async removePriceRule(
    courtId: string,
    priceRuleId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const court = await this.findOne(courtId);
    this.assertOwnerOrAdmin(court.venue, user);

    const result = await this.dataSource
      .getRepository(PriceRule)
      .delete({ id: priceRuleId, court: { id: courtId } });
    if (!result.affected) {
      throw new NotFoundException('Price rule không tồn tại');
    }
  }

  async getSlots(courtId: string, query: SlotQueryDto): Promise<SlotDto[]> {
    const court = await this.findOne(courtId);
    const dayOfWeek = new Date(`${query.date}T00:00:00Z`).getUTCDay();

    const activeBookings = await this.dataSource.getRepository(Booking).find({
      where: {
        court: { id: courtId },
        bookingDate: query.date,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
      },
    });
    const bookedStartTimes = new Set(
      // Postgres returns `time` columns as "HH:mm:ss"; slots are "HH:mm".
      activeBookings.map((b) => b.startTime.slice(0, 5)),
    );

    const slots: SlotDto[] = [];
    for (let hour = OPERATING_START_HOUR; hour < OPERATING_END_HOUR; hour++) {
      const startTime = `${String(hour).padStart(2, '0')}:00`;
      const endTime = `${String(hour + 1).padStart(2, '0')}:00`;
      const price = await this.getHourlyRate(
        court,
        dayOfWeek,
        startTime,
        endTime,
      );
      slots.push({
        startTime,
        endTime,
        price,
        available: !bookedStartTimes.has(startTime),
      });
    }
    return slots;
  }

  private async getHourlyRate(
    court: Court,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
  ): Promise<number> {
    const rule = await this.dataSource.getRepository(PriceRule).findOne({
      where: {
        court: { id: court.id },
        dayOfWeek,
        startTime: LessThanOrEqual(startTime),
        endTime: MoreThanOrEqual(endTime),
      },
    });
    return Number(rule ? rule.price : court.basePrice);
  }

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên sân này');
    }
  }
}
