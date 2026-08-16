import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { VenueStatus } from '@sportspace/shared';
import { AdminController } from './admin.controller';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';
import { PaginatedDto } from '../common/dto/paginated.dto';

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

  it('getVenues() forwards the query params to the service', async () => {
    const expected: PaginatedDto<Venue> = {
      data: [createMock<Venue>()],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    service.findAllForAdmin.mockResolvedValue(expected);

    const query = { page: 1, limit: 20, status: VenueStatus.APPROVED };
    const result = await controller.getVenues(query);

    expect(service.findAllForAdmin).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('getVenueProvinces() returns the distinct provinces from the service', async () => {
    const expected = ['Hà Nội', 'Huế'];
    service.listDistinctProvinces.mockResolvedValue(expected);

    const result = await controller.getVenueProvinces();

    expect(service.listDistinctProvinces).toHaveBeenCalled();
    expect(result).toBe(expected);
  });
});
