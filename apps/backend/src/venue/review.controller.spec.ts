import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@sportspace/shared';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { Review } from './entities/review.entity';

describe('ReviewController', () => {
  let controller: ReviewController;
  let service: DeepMocked<ReviewService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: createMock<ReviewService>() }],
    }).compile();

    controller = module.get<ReviewController>(ReviewController);
    service = module.get(ReviewService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() forwards dto and the authenticated user', async () => {
    const user = { id: faker.string.uuid(), email: faker.internet.email(), role: Role.PLAYER };
    const dto = { bookingId: faker.string.uuid(), rating: 5 };
    const expected = createMock<Review>();
    service.create.mockResolvedValue(expected);

    const result = await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
    expect(result).toBe(expected);
  });

  it('findByVenue() forwards the venueId query param', async () => {
    const venueId = faker.string.uuid();
    service.listByVenue.mockResolvedValue({ averageRating: 0, total: 0, items: [] });

    await controller.findByVenue(venueId);

    expect(service.listByVenue).toHaveBeenCalledWith(venueId);
  });
});
