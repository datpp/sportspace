import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { VenueStatus } from '@sportspace/shared';
import { AdminController } from './admin.controller';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';

describe('AdminController', () => {
  let controller: AdminController;
  let service: DeepMocked<VenueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: VenueService, useValue: createMock<VenueService>() },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get(VenueService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getVenues() defaults to PENDING when no status query is given', async () => {
    const expected = [createMock<Venue>()];
    service.findAllForAdmin.mockResolvedValue(expected);

    const result = await controller.getVenues({});

    expect(service.findAllForAdmin).toHaveBeenCalledWith(VenueStatus.PENDING);
    expect(result).toBe(expected);
  });

  it('getVenues() forwards an explicit status query', async () => {
    const expected = [createMock<Venue>()];
    service.findAllForAdmin.mockResolvedValue(expected);

    const result = await controller.getVenues({ status: VenueStatus.APPROVED });

    expect(service.findAllForAdmin).toHaveBeenCalledWith(VenueStatus.APPROVED);
    expect(result).toBe(expected);
  });
});
