import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisputeStatus } from '@sportspace/shared';
import { Repository } from 'typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { Dispute } from './entities/dispute.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentService } from '../payment/payment.service';

describe('DisputeService', () => {
  let service: DisputeService;
  let disputeRepo: DeepMocked<Repository<Dispute>>;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let paymentRepo: DeepMocked<Repository<Payment>>;
  let paymentService: DeepMocked<PaymentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        { provide: getRepositoryToken(Dispute), useValue: createMock<Repository<Dispute>>() },
        { provide: getRepositoryToken(Booking), useValue: createMock<Repository<Booking>>() },
        { provide: getRepositoryToken(Payment), useValue: createMock<Repository<Payment>>() },
        { provide: PaymentService, useValue: createMock<PaymentService>() },
      ],
    }).compile();

    service = module.get(DisputeService);
    disputeRepo = module.get(getRepositoryToken(Dispute));
    bookingRepo = module.get(getRepositoryToken(Booking));
    paymentRepo = module.get(getRepositoryToken(Payment));
    paymentService = module.get(PaymentService);
  });

  it('create() rejects a booking the caller does not own', async () => {
    const userId = faker.string.uuid();
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      user: { id: faker.string.uuid() },
    } as Booking);

    await expect(
      service.create(userId, { bookingId: 'b1', reason: 'Sân không đạt chuẩn' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('create() saves an OPEN dispute for the owning player', async () => {
    const userId = faker.string.uuid();
    bookingRepo.findOne.mockResolvedValue({ id: 'b1', user: { id: userId } } as Booking);
    disputeRepo.create.mockImplementation((v) => v as Dispute);
    disputeRepo.save.mockImplementation(async (d) => d as Dispute);

    const result = await service.create(userId, {
      bookingId: 'b1',
      reason: 'Sân không đạt chuẩn',
    });

    expect(result.status).toBe(DisputeStatus.OPEN);
  });

  it('resolve() rejects resolving an already-resolved dispute', async () => {
    disputeRepo.findOne.mockResolvedValue({
      id: 'd1',
      status: DisputeStatus.RESOLVED,
    } as Dispute);

    await expect(
      service.resolve('d1', 'admin1', {
        status: DisputeStatus.REJECTED,
        resolutionNote: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolve() with REJECTED status does not call applyRefund', async () => {
    disputeRepo.findOne.mockResolvedValue({
      id: 'd1',
      status: DisputeStatus.OPEN,
      booking: { id: 'b1' },
    } as Dispute);
    disputeRepo.save.mockImplementation(async (d) => d as Dispute);

    await service.resolve('d1', 'admin1', {
      status: DisputeStatus.REJECTED,
      resolutionNote: 'Không đủ căn cứ',
    });

    expect(paymentService.applyRefund).not.toHaveBeenCalled();
  });

  it('resolve() with RESOLVED status + refundAmount calls applyRefund on the booking payment', async () => {
    disputeRepo.findOne.mockResolvedValue({
      id: 'd1',
      status: DisputeStatus.OPEN,
      booking: { id: 'b1' },
    } as Dispute);
    disputeRepo.save.mockImplementation(async (d) => d as Dispute);
    paymentRepo.findOne.mockResolvedValue({ id: 'p1' } as Payment);

    await service.resolve('d1', 'admin1', {
      status: DisputeStatus.RESOLVED,
      resolutionNote: 'Khiếu nại hợp lệ',
      refundAmount: 100000,
    });

    expect(paymentService.applyRefund).toHaveBeenCalledWith(
      'p1',
      100000,
      'Khiếu nại hợp lệ',
    );
  });
});
