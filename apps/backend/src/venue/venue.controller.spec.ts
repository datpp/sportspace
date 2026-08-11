import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@sportspace/shared';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';

describe('VenueController', () => {
  let controller: VenueController;
  let service: DeepMocked<VenueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenueController],
      providers: [
        { provide: VenueService, useValue: createMock<VenueService>() },
      ],
    }).compile();

    controller = module.get<VenueController>(VenueController);
    service = module.get(VenueService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() forwards the authenticated userId as owner', async () => {
    const ownerId = faker.string.uuid();
    const dto = {
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.76,
      lng: 106.66,
    };
    const expected = createMock<Venue>();
    service.create.mockResolvedValue(expected);

    const result = await controller.create(ownerId, dto);

    expect(service.create).toHaveBeenCalledWith(ownerId, dto);
    expect(result).toBe(expected);
  });

  it('update() forwards the authenticated user for ownership checks', async () => {
    const id = faker.string.uuid();
    const user = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      role: Role.MERCHANT,
    };
    const expected = createMock<Venue>();
    service.update.mockResolvedValue(expected);

    const result = await controller.update(id, { name: 'X' }, user);

    expect(service.update).toHaveBeenCalledWith(id, { name: 'X' }, user);
    expect(result).toBe(expected);
  });

  it('approve() forwards the venue id to VenueService.approve', async () => {
    const id = faker.string.uuid();
    const expected = createMock<Venue>();
    service.approve.mockResolvedValue(expected);

    const result = await controller.approve(id);

    expect(service.approve).toHaveBeenCalledWith(id);
    expect(result).toBe(expected);
  });

  it('reject() forwards the venue id to VenueService.reject', async () => {
    const id = faker.string.uuid();
    const expected = createMock<Venue>();
    service.reject.mockResolvedValue(expected);

    const result = await controller.reject(id);

    expect(service.reject).toHaveBeenCalledWith(id);
    expect(result).toBe(expected);
  });
});
