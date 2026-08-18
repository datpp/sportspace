import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { BookingStatus, PaymentStatus, Role } from '@sportspace/shared';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { Court } from '../venue/entities/court.entity';
import { PriceRule } from '../venue/entities/price-rule.entity';
import { User } from '../user/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueDto } from './dto/revenue.dto';
import { RevenueTimeseriesQueryDto } from './dto/revenue-timeseries-query.dto';
import { RevenueTimeseriesPointDto } from './dto/revenue-timeseries-point.dto';
import { MerchantBookingsQueryDto } from './dto/merchant-bookings-query.dto';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';
import { Booking, BookingServiceSummary } from './entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AddOnService } from '../addon-services/entities/add-on-service.entity';
import { BookingServiceItem } from '../addon-services/entities/booking-service-item.entity';
import {
  calculateRefundPercentage,
  combineBookingDateTime,
} from './refund-policy.util';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { RejectBookingDto } from './dto/reject-booking.dto';

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
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationService: NotificationService,
    private readonly paymentService: PaymentService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async create(userId: string, dto: CreateBookingDto): Promise<Booking> {
    this.assertValidTimeRange(dto.startTime, dto.endTime);

    const booking = await this.withSlotLock(
      dto.courtId,
      dto.bookingDate,
      dto.startTime,
      async (manager) => {
        const court = await manager.findOne(Court, {
          where: { id: dto.courtId },
          relations: { venue: true },
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

        let totalAmount = await this.computeTotalAmount(
          manager,
          court,
          dto.bookingDate,
          dto.startTime,
          dto.endTime,
        );

        const serviceSummaries: BookingServiceSummary[] = [];
        const resolvedServices: { addOnService: AddOnService; quantity: number }[] =
          [];
        for (const item of dto.services ?? []) {
          const addOnService = await manager.findOne(AddOnService, {
            where: { id: item.addOnServiceId },
            relations: { venue: true },
          });
          if (!addOnService || addOnService.venue.id !== court.venue.id) {
            throw new BadRequestException(
              'Dịch vụ không thuộc cụm sân của sân đã chọn',
            );
          }
          totalAmount += Number(addOnService.price) * item.quantity;
          resolvedServices.push({ addOnService, quantity: item.quantity });
        }

        const booking = manager.create(Booking, {
          court,
          user,
          bookingDate: dto.bookingDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: BookingStatus.PENDING,
          totalAmount,
        });
        const saved = await manager.save(Booking, booking);

        for (const { addOnService, quantity } of resolvedServices) {
          const item = manager.create(BookingServiceItem, {
            booking: saved,
            addOnService,
            quantity,
            unitPrice: addOnService.price,
          });
          await manager.save(BookingServiceItem, item);
          serviceSummaries.push({
            id: item.id,
            name: addOnService.name,
            quantity,
            unitPrice: Number(addOnService.price),
          });
        }
        if (serviceSummaries.length > 0) {
          saved.services = serviceSummaries;
        }
        return saved;
      },
    );

    this.realtimeGateway.broadcastSlotUpdate({
      courtId: dto.courtId,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      status: BookingStatus.PENDING,
    });

    return booking;
  }

  async findAll(user: AuthenticatedUser): Promise<Booking[]> {
    const where = user.role === Role.ADMIN ? {} : { user: { id: user.id } };
    const bookings = await this.bookingRepo.find({
      where,
      relations: { court: true, user: true },
    });
    await this.attachPaymentSummaries(bookings);
    return bookings;
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: { court: true, user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    this.assertOwnerOrAdmin(booking, user);
    return booking;
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    user: AuthenticatedUser,
  ): Promise<Booking> {
    const current = await this.findOne(id, user);
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

    this.realtimeGateway.broadcastSlotUpdate({
      courtId: current.court.id,
      bookingDate: current.bookingDate,
      startTime: current.startTime,
      status: BookingStatus.CANCELLED,
    });
    this.realtimeGateway.broadcastSlotUpdate({
      courtId,
      bookingDate,
      startTime,
      status: current.status,
    });

    return this.findOne(id, user);
  }

  /**
   * Refund policy (CLAUDE.md §7): only a PAID payment can be refunded. A
   * refundAmount of 0 (the <2h band) leaves the payment PAID — no money
   * moved, so REFUNDED would be misleading.
   */
  async cancel(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findOne(id, user);
    if (booking.status === BookingStatus.CANCELLED) {
      return booking;
    }

    const payment = await this.paymentRepo.findOne({
      where: { booking: { id: booking.id } },
    });

    if (payment && payment.status === PaymentStatus.PAID) {
      const slotStart = combineBookingDateTime(
        booking.bookingDate,
        booking.startTime,
      );
      const config = await this.systemConfigService.get();
      const refundPercentage = calculateRefundPercentage(
        new Date(),
        slotStart,
        config.cancellationFullRefundHours,
        config.cancellationPartialRefundHours,
        config.cancellationPartialRefundPercent / 100,
      );
      const refundAmount =
        Math.round(Number(booking.totalAmount) * refundPercentage * 100) /
        100;

      payment.refundAmount = refundAmount;
      if (refundAmount > 0) {
        payment.status = PaymentStatus.REFUNDED;
      }
      await this.paymentRepo.save(payment);
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepo.save(booking);
    this.realtimeGateway.broadcastSlotUpdate({
      courtId: booking.court.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      status: BookingStatus.CANCELLED,
    });

    if (payment) {
      booking.payment = {
        status: payment.status,
        refundAmount: payment.refundAmount,
      };
    }

    return booking;
  }

  async merchantConfirm(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findOneForMerchant(id);
    this.assertMerchantOwnerOrAdmin(booking, user);
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException('Chỉ có thể xác nhận đơn đang chờ (PENDING)');
    }

    booking.status = BookingStatus.CONFIRMED;
    await this.bookingRepo.save(booking);

    this.realtimeGateway.broadcastSlotUpdate({
      courtId: booking.court.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      status: BookingStatus.CONFIRMED,
    });
    await this.notificationService.notify(
      booking.user.id,
      'Đơn đặt sân đã được xác nhận',
      `Chủ sân đã xác nhận đơn đặt sân ngày ${booking.bookingDate} lúc ${booking.startTime}.`,
    );

    return booking;
  }

  /**
   * Merchant-initiated rejection is never the player's fault, so — unlike
   * player cancel — this always refunds 100% of whatever was already paid.
   */
  async merchantReject(
    id: string,
    dto: RejectBookingDto,
    user: AuthenticatedUser,
  ): Promise<Booking> {
    const booking = await this.findOneForMerchant(id);
    this.assertMerchantOwnerOrAdmin(booking, user);
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new ConflictException('Đơn đặt sân này đã bị hủy trước đó');
    }

    const wasConfirmed = booking.status === BookingStatus.CONFIRMED;
    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepo.save(booking);

    if (wasConfirmed) {
      await this.paymentService.refundFull(booking.id);
    }

    this.realtimeGateway.broadcastSlotUpdate({
      courtId: booking.court.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      status: BookingStatus.CANCELLED,
    });
    await this.notificationService.notify(
      booking.user.id,
      'Đơn đặt sân bị từ chối',
      `Chủ sân đã từ chối đơn đặt sân ngày ${booking.bookingDate} lúc ${booking.startTime}. Lý do: ${dto.reason}`,
    );

    return booking;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    const result = await this.bookingRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Booking không tồn tại');
    }
  }

  private async attachPaymentSummaries(bookings: Booking[]): Promise<void> {
    if (bookings.length === 0) {
      return;
    }
    const payments = await this.paymentRepo.find({
      where: { booking: { id: In(bookings.map((b) => b.id)) } },
      relations: { booking: true },
    });
    const byBookingId = new Map(payments.map((p) => [p.booking.id, p]));
    for (const booking of bookings) {
      const payment = byBookingId.get(booking.id);
      if (payment) {
        booking.payment = {
          status: payment.status,
          refundAmount: payment.refundAmount,
        };
      }
    }
  }

  private assertOwnerOrAdmin(booking: Booking, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && booking.user.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên đơn đặt sân này',
      );
    }
  }

  private async findOneForMerchant(id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: { court: { venue: { owner: true } }, user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    return booking;
  }

  private assertMerchantOwnerOrAdmin(
    booking: Booking,
    user: AuthenticatedUser,
  ): void {
    if (user.role !== Role.ADMIN && booking.court.venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên đơn đặt sân này',
      );
    }
  }

  async findAllForMerchant(
    merchantId: string,
    query: MerchantBookingsQueryDto,
  ): Promise<PaginatedDto<Booking>> {
    const { page, limit, q, venueId, from, to } = query;

    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.court', 'court')
      .leftJoinAndSelect('booking.user', 'user')
      .innerJoin('court.venue', 'venue')
      .where('venue.owner = :merchantId', { merchantId })
      .orderBy('booking.createdAt', 'DESC');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('booking.status = :status', { status: query.status });
    } else if (!query.status) {
      qb.andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      });
    }
    if (q?.trim()) {
      qb.andWhere(
        '(user.fullName ILIKE :q OR user.email ILIKE :q OR court.name ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }
    if (venueId) {
      qb.andWhere('venue.id = :venueId', { venueId });
    }
    if (from) {
      qb.andWhere('booking.bookingDate >= :from', { from });
    }
    if (to) {
      qb.andWhere('booking.bookingDate <= :to', { to });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
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
   * Revenue broken down per bucket (day for week/month, calendar month for
   * year) so the frontend can plot a real trend line. Zero-filled: buckets
   * with no CONFIRMED bookings still appear with revenue/bookings = 0,
   * otherwise a gap in the data reads as a broken chart rather than "no
   * activity that day".
   */
  async getMerchantRevenueTimeseries(
    merchantId: string,
    query: RevenueTimeseriesQueryDto,
  ): Promise<RevenueTimeseriesPointDto[]> {
    const { since, granularity, buckets } = this.buildTimeseriesBuckets(
      query.range ?? 'month',
    );
    // Always cast through to_char: selecting the raw `date` column via
    // getRawMany() (unlike hydrated entities) comes back as a JS Date built
    // from local-timezone components, which drifts a day off the UTC-based
    // bucket keys below whenever the server's TZ isn't UTC. to_char forces
    // Postgres to hand back plain text, sidestepping that entirely.
    const bucketExpr =
      granularity === 'month'
        ? "to_char(booking.bookingDate, 'YYYY-MM')"
        : "to_char(booking.bookingDate, 'YYYY-MM-DD')";

    const rows = await this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.court', 'court')
      .innerJoin('court.venue', 'venue')
      .where('venue.owner = :merchantId', { merchantId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('booking.bookingDate >= :since', { since })
      .select(bucketExpr, 'bucket')
      .addSelect('COALESCE(SUM(booking.totalAmount), 0)', 'revenue')
      .addSelect('COUNT(booking.id)', 'bookings')
      .groupBy(bucketExpr)
      .getRawMany<{ bucket: string; revenue: string; bookings: string }>();

    const byBucket = new Map(rows.map((row) => [row.bucket, row]));

    return buckets.map((bucket) => {
      const row = byBucket.get(bucket);
      return {
        bucket,
        revenue: row ? Number(row.revenue) : 0,
        bookings: row ? Number(row.bookings) : 0,
      };
    });
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

  /**
   * Fixed point counts per range so the frontend always gets a predictable
   * series length: 7 days for `week`, 30 days for `month`, 12 calendar
   * months for `year`. `since` is the first bucket's start date, used to
   * scope the DB query so the query and the zero-fill list can never drift
   * out of sync.
   */
  private buildTimeseriesBuckets(range: 'week' | 'month' | 'year'): {
    since: string;
    granularity: 'day' | 'month';
    buckets: string[];
  } {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (range === 'year') {
      const buckets: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
        );
        buckets.push(
          `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        );
      }
      return { since: `${buckets[0]}-01`, granularity: 'month', buckets };
    }

    const days = range === 'week' ? 7 : 30;
    const buckets: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      buckets.push(d.toISOString().slice(0, 10));
    }
    return { since: buckets[0], granularity: 'day', buckets };
  }
}
