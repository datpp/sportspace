import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@sportspace/shared';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildAuthUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.PLAYER,
    ...overrides,
  };
}

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

  it('findAll() forwards the authenticated user to BookingService.findAll', async () => {
    const user = buildAuthUser();
    const expected = [createMock<Booking>()];
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(user);

    expect(service.findAll).toHaveBeenCalledWith(user);
    expect(result).toBe(expected);
  });

  it('findOne() forwards id + authenticated user to BookingService.findOne', async () => {
    const id = faker.string.uuid();
    const user = buildAuthUser();
    const expected = createMock<Booking>();
    service.findOne.mockResolvedValue(expected);

    const result = await controller.findOne(id, user);

    expect(service.findOne).toHaveBeenCalledWith(id, user);
    expect(result).toBe(expected);
  });

  it('update() forwards id + dto + authenticated user to BookingService.update', async () => {
    const id = faker.string.uuid();
    const user = buildAuthUser();
    const dto = { startTime: '11:00' };
    const expected = createMock<Booking>();
    service.update.mockResolvedValue(expected);

    const result = await controller.update(id, dto, user);

    expect(service.update).toHaveBeenCalledWith(id, dto, user);
    expect(result).toBe(expected);
  });

  it('cancel() forwards id + authenticated user to BookingService.cancel', async () => {
    const id = faker.string.uuid();
    const user = buildAuthUser();
    const expected = createMock<Booking>();
    service.cancel.mockResolvedValue(expected);

    const result = await controller.cancel(id, user);

    expect(service.cancel).toHaveBeenCalledWith(id, user);
    expect(result).toBe(expected);
  });

  it('remove() forwards id + authenticated user to BookingService.remove', async () => {
    const id = faker.string.uuid();
    const user = buildAuthUser();

    await controller.remove(id, user);

    expect(service.remove).toHaveBeenCalledWith(id, user);
  });
});
