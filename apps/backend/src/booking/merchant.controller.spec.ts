import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { MerchantController } from './merchant.controller';
import { BookingService } from './booking.service';
import { VenueService } from '../venue/venue.service';
import { Venue } from '../venue/entities/venue.entity';
import { RevenueDto } from './dto/revenue.dto';
import { RevenueTimeseriesPointDto } from './dto/revenue-timeseries-point.dto';

describe('MerchantController', () => {
  let controller: MerchantController;
  let bookingService: DeepMocked<BookingService>;
  let venueService: DeepMocked<VenueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantController],
      providers: [
        { provide: BookingService, useValue: createMock<BookingService>() },
        { provide: VenueService, useValue: createMock<VenueService>() },
      ],
    }).compile();

    controller = module.get<MerchantController>(MerchantController);
    bookingService = module.get(BookingService);
    venueService = module.get(VenueService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getRevenue() forwards the authenticated merchantId and query to BookingService', async () => {
    const merchantId = faker.string.uuid();
    const query = { range: 'month' as const };
    const expected: RevenueDto = { totalRevenue: 1000000, totalBookings: 5 };
    bookingService.getMerchantRevenue.mockResolvedValue(expected);

    const result = await controller.getRevenue(merchantId, query);

    expect(bookingService.getMerchantRevenue).toHaveBeenCalledWith(
      merchantId,
      query,
    );
    expect(result).toBe(expected);
  });

  it('getRevenueTimeseries() forwards the authenticated merchantId and query to BookingService', async () => {
    const merchantId = faker.string.uuid();
    const query = { range: 'week' as const };
    const expected: RevenueTimeseriesPointDto[] = [
      { bucket: '2026-09-01', revenue: 200000, bookings: 1 },
    ];
    bookingService.getMerchantRevenueTimeseries.mockResolvedValue(expected);

    const result = await controller.getRevenueTimeseries(merchantId, query);

    expect(bookingService.getMerchantRevenueTimeseries).toHaveBeenCalledWith(
      merchantId,
      query,
    );
    expect(result).toBe(expected);
  });

  it('getVenues() forwards the authenticated merchantId and query to VenueService.findByOwner', async () => {
    const merchantId = faker.string.uuid();
    const query = { page: 1, limit: 20 };
    const expected = {
      data: [createMock<Venue>()],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    venueService.findByOwner.mockResolvedValue(expected);

    const result = await controller.getVenues(merchantId, query);

    expect(venueService.findByOwner).toHaveBeenCalledWith(
      merchantId,
      query,
    );
    expect(result).toBe(expected);
  });
});
