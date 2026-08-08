import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@sportspace/shared';
import { CourtController } from './court.controller';
import { CourtService } from './court.service';
import { Court } from './entities/court.entity';

describe('CourtController', () => {
  let controller: CourtController;
  let service: DeepMocked<CourtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourtController],
      providers: [
        { provide: CourtService, useValue: createMock<CourtService>() },
      ],
    }).compile();

    controller = module.get<CourtController>(CourtController);
    service = module.get(CourtService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() forwards dto and the authenticated user', async () => {
    const user = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      role: Role.MERCHANT,
    };
    const dto = {
      venueId: faker.string.uuid(),
      name: 'Sân 1',
      sport: 'football',
      basePrice: 200_000,
    };
    const expected = createMock<Court>();
    service.create.mockResolvedValue(expected);

    const result = await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
    expect(result).toBe(expected);
  });

  it('getSlots() forwards courtId and the date query', async () => {
    const id = faker.string.uuid();
    const query = { date: '2026-09-01' };
    service.getSlots.mockResolvedValue([]);

    await controller.getSlots(id, query);

    expect(service.getSlots).toHaveBeenCalledWith(id, query);
  });
});
