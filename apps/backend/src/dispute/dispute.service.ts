import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DisputeStatus } from '@sportspace/shared';
import { Repository } from 'typeorm';
import { Dispute } from './entities/dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { FindDisputesQueryDto } from './dto/find-disputes-query.dto';
import { Booking } from '../booking/entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentService } from '../payment/payment.service';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute) private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    private readonly paymentService: PaymentService,
  ) {}

  async create(userId: string, dto: CreateDisputeDto): Promise<Dispute> {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.bookingId },
      relations: { user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    if (booking.user.id !== userId) {
      throw new ForbiddenException('Bạn không có quyền khiếu nại đơn này');
    }

    const dispute = this.disputeRepo.create({
      booking,
      raisedBy: { id: userId } as never,
      reason: dto.reason,
      status: DisputeStatus.OPEN,
    });
    return this.disputeRepo.save(dispute);
  }

  async findAll(query: FindDisputesQueryDto): Promise<PaginatedDto<Dispute>> {
    const { page, limit, q } = query;
    const status = query.status ?? DisputeStatus.OPEN;

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.booking', 'booking')
      .leftJoinAndSelect('dispute.raisedBy', 'raisedBy')
      .orderBy('dispute.createdAt', 'DESC');

    if (status !== 'ALL') {
      qb.andWhere('dispute.status = :status', { status });
    }
    if (q?.trim()) {
      qb.andWhere(
        '(dispute.reason ILIKE :q OR raisedBy.fullName ILIKE :q OR raisedBy.email ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async resolve(
    id: string,
    adminId: string,
    dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({
      where: { id },
      relations: { booking: true },
    });
    if (!dispute) {
      throw new NotFoundException('Khiếu nại không tồn tại');
    }
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException('Khiếu nại đã được xử lý');
    }

    if (dto.status === DisputeStatus.RESOLVED && dto.refundAmount) {
      const payment = await this.paymentRepo.findOne({
        where: { booking: { id: dispute.booking.id } },
      });
      if (!payment) {
        throw new BadRequestException('Đơn đặt sân chưa có giao dịch thanh toán');
      }
      await this.paymentService.applyRefund(
        payment.id,
        dto.refundAmount,
        dto.resolutionNote,
      );
    }

    dispute.status = dto.status;
    dispute.resolutionNote = dto.resolutionNote;
    dispute.resolvedBy = { id: adminId } as never;
    return this.disputeRepo.save(dispute);
  }
}
