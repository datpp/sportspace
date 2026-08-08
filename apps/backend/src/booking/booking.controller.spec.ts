import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';

describe('BookingController', () => {
  let controller: BookingController;
  let service: DeepMocked<BookingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        { provide: BookingService, useValue: createMock<BookingService>() },
      ],
    }).compile();

    controller = module.get<BookingController>(BookingController);
    service = module.get(BookingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() forwards the authenticated userId to BookingService.create', async () => {
    const userId = faker.string.uuid();
    const dto = {
      courtId: faker.string.uuid(),
      bookingDate: '2026-08-10',
      startTime: '09:00',
      endTime: '10:00',
    };
    const expected = createMock<Booking>();
    service.create.mockResolvedValue(expected);

    const result = await controller.create(userId, dto);

    expect(service.create).toHaveBeenCalledWith(userId, dto);
    expect(result).toBe(expected);
  });

  it('cancel() delegates to BookingService.cancel', async () => {
    const id = faker.string.uuid();
    const expected = createMock<Booking>();
    service.cancel.mockResolvedValue(expected);

    const result = await controller.cancel(id);

    expect(service.cancel).toHaveBeenCalledWith(id);
    expect(result).toBe(expected);
  });
});
