import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { BookingStatus } from '@sportspace/shared';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { Court } from '../venue/entities/court.entity';
import { PriceRule } from '../venue/entities/price-rule.entity';
import { User } from '../user/entities/user.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueDto } from './dto/revenue.dto';
import { Booking } from './entities/booking.entity';

const SLOT_LOCK_TTL_SECONDS = 10;
const ACTIVE_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
const POSTGRES_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  const code =
    (err as { code?: string; driverError?: { code?: string } })?.driverError
      ?.code ?? (err as { code?: string })?.code;
  return code === POSTGRES_UNIQUE_VIOLATION;
}

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async create(userId: string, dto: CreateBookingDto): Promise<Booking> {
    this.assertValidTimeRange(dto.startTime, dto.endTime);

    return this.withSlotLock(
      dto.courtId,
      dto.bookingDate,
      dto.startTime,
      async (manager) => {
        const court = await manager.findOne(Court, {
          where: { id: dto.courtId },
        });
        if (!court) {
          throw new NotFoundException('Sân không tồn tại');
        }
        const user = await manager.findOne(User, { where: { id: userId } });
        if (!user) {
          throw new NotFoundException('Người dùng không tồn tại');
        }

        await this.assertSlotFree(
          manager,
          dto.courtId,
          dto.bookingDate,
          dto.startTime,
        );

        const totalAmount = await this.computeTotalAmount(
          manager,
          court,
          dto.bookingDate,
          dto.startTime,
          dto.endTime,
        );
        const booking = manager.create(Booking, {
          court,
          user,
          bookingDate: dto.bookingDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: BookingStatus.PENDING,
          totalAmount,
        });
        return manager.save(Booking, booking);
      },
    );
  }

  findAll(): Promise<Booking[]> {
    return this.bookingRepo.find({ relations: { court: true, user: true } });
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: { court: true, user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    return booking;
  }

  async update(id: string, dto: UpdateBookingDto): Promise<Booking> {
    const current = await this.findOne(id);
    const courtId = dto.courtId ?? current.court.id;
    const bookingDate = dto.bookingDate ?? current.bookingDate;
    const startTime = dto.startTime ?? current.startTime;
    const endTime = dto.endTime ?? current.endTime;

    const slotChanged =
      courtId !== current.court.id ||
      bookingDate !== current.bookingDate ||
      startTime !== current.startTime;

    if (!slotChanged) {
      return current;
    }

    this.assertValidTimeRange(startTime, endTime);

    await this.withSlotLock(
      courtId,
      bookingDate,
      startTime,
      async (manager) => {
        const court = await manager.findOne(Court, { where: { id: courtId } });
        if (!court) {
          throw new NotFoundException('Sân không tồn tại');
        }

        await this.assertSlotFree(manager, courtId, bookingDate, startTime, id);

        const totalAmount = await this.computeTotalAmount(
          manager,
          court,
          bookingDate,
          startTime,
          endTime,
        );
        await manager.update(Booking, id, {
          court,
          bookingDate,
          startTime,
          endTime,
          totalAmount,
        });
      },
    );

    return this.findOne(id);
  }

  async cancel(id: string): Promise<Booking> {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.CANCELLED) {
      booking.status = BookingStatus.CANCELLED;
      await this.bookingRepo.save(booking);
    }
    return booking;
  }

  async remove(id: string): Promise<void> {
    const result = await this.bookingRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Booking không tồn tại');
    }
  }

  async getMerchantRevenue(
    merchantId: string,
    query: RevenueQueryDto,
  ): Promise<RevenueDto> {
    const since = this.rangeStartDate(query.range ?? 'month');

    const raw = await this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.court', 'court')
      .innerJoin('court.venue', 'venue')
      .where('venue.owner = :merchantId', { merchantId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('booking.bookingDate >= :since', { since })
      .select('COALESCE(SUM(booking.totalAmount), 0)', 'totalRevenue')
      .addSelect('COUNT(booking.id)', 'totalBookings')
      .getRawOne<{ totalRevenue: string; totalBookings: string }>();

    return {
      totalRevenue: Number(raw?.totalRevenue ?? 0),
      totalBookings: Number(raw?.totalBookings ?? 0),
    };
  }

  /**
   * Layer 1 (Redis SET NX EX) + Layer 2 (pessimistic DB lock, inside `work`) +
   * Layer 3 (UNIQUE partial index, caught as 23505 here) — see CLAUDE.md §6.
   */
  private async withSlotLock<T>(
    courtId: string,
    bookingDate: string,
    startTime: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const lockKey = `lock:court:${courtId}:${bookingDate}:${startTime}`;
    const lockToken = await this.redisService.acquireLock(
      lockKey,
      SLOT_LOCK_TTL_SECONDS,
    );
    if (!lockToken) {
      throw new ConflictException('Ô giờ đang được đặt, vui lòng thử lại');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const result = await work(queryRunner.manager);
        await queryRunner.commitTransaction();
        return result;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        if (isUniqueViolation(err)) {
          throw new ConflictException('Ô giờ đã được đặt');
        }
        throw err;
      }
    } finally {
      try {
        await queryRunner.release();
      } finally {
        await this.redisService.releaseLock(lockKey, lockToken);
      }
    }
  }

  private async assertSlotFree(
    manager: EntityManager,
    courtId: string,
    bookingDate: string,
    startTime: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = manager
      .createQueryBuilder(Booking, 'booking')
      .setLock('pessimistic_write')
      .where('booking.court = :courtId', { courtId })
      .andWhere('booking.bookingDate = :bookingDate', { bookingDate })
      .andWhere('booking.startTime = :startTime', { startTime })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ACTIVE_STATUSES,
      });

    if (excludeId) {
      qb.andWhere('booking.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException('Ô giờ đã được đặt');
    }
  }

  private async computeTotalAmount(
    manager: EntityManager,
    court: Court,
    bookingDate: string,
    startTime: string,
    endTime: string,
  ): Promise<number> {
    const dayOfWeek = new Date(`${bookingDate}T00:00:00Z`).getUTCDay();
    const rule = await manager.findOne(PriceRule, {
      where: {
        court: { id: court.id },
        dayOfWeek,
        startTime: LessThanOrEqual(startTime),
        endTime: MoreThanOrEqual(endTime),
      },
    });

    const hourlyRate = Number(rule ? rule.price : court.basePrice);
    const hours = this.diffHours(startTime, endTime);
    return Math.round(hourlyRate * hours * 100) / 100;
  }

  private diffHours(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    return (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;
  }

  private assertValidTimeRange(startTime: string, endTime: string): void {
    if (this.diffHours(startTime, endTime) <= 0) {
      throw new BadRequestException('endTime phải sau startTime');
    }
  }

  private rangeStartDate(range: 'day' | 'week' | 'month' | 'year'): string {
    const start = new Date();
    switch (range) {
      case 'day':
        break;
      case 'week':
        start.setUTCDate(start.getUTCDate() - 7);
        break;
      case 'year':
        start.setUTCFullYear(start.getUTCFullYear() - 1);
        break;
      case 'month':
      default:
        start.setUTCMonth(start.getUTCMonth() - 1);
        break;
    }
    return start.toISOString().slice(0, 10);
  }
}
