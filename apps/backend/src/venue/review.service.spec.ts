import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus, Role } from '@sportspace/shared';
import { ReviewService } from './review.service';
import { Review } from './entities/review.entity';
import { Venue } from './entities/venue.entity';
import { Court } from './entities/court.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildAuthUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.PLAYER,
    ...overrides,
  };
}

function buildBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: faker.string.uuid(),
    user: { id: faker.string.uuid() } as User,
    court: { id: faker.string.uuid(), venue: { id: faker.string.uuid() } as Venue } as Court,
    bookingDate: '2020-01-01',
    status: BookingStatus.CONFIRMED,
    ...overrides,
  } as Booking;
}

describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepo: DeepMocked<Repository<Review>>;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let dataSource: DeepMocked<DataSource>;

  beforeEach(() => {
    reviewRepo = createMock<Repository<Review>>();
    bookingRepo = createMock<Repository<Booking>>();
    dataSource = createMock<DataSource>();
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Booking) return bookingRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });
    reviewRepo.create.mockImplementation(((data: object) => data) as typeof reviewRepo.create);
    reviewRepo.save.mockImplementation((r) => Promise.resolve(r as Review));

    service = new ReviewService(reviewRepo, dataSource);
  });

  describe('create', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ bookingId: faker.string.uuid(), rating: 5 }, buildAuthUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the requester did not make the booking', async () => {
      const booking = buildBooking();
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, buildAuthUser({ id: faker.string.uuid() })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the booking is not CONFIRMED', async () => {
      const user = buildAuthUser();
      const booking = buildBooking({ user: { id: user.id } as User, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the booking date has not passed yet', async () => {
      const user = buildAuthUser();
      const future = new Date();
      future.setDate(future.getDate() + 3);
      const booking = buildBooking({
        user: { id: user.id } as User,
        bookingDate: future.toISOString().slice(0, 10),
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the booking already has a review', async () => {
      const user = buildAuthUser();
      const booking = buildBooking({ user: { id: user.id } as User });
      bookingRepo.findOne.mockResolvedValue(booking);
      reviewRepo.findOne.mockResolvedValue(createMock<Review>());
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the review when the booking is eligible', async () => {
      const user = buildAuthUser();
      const booking = buildBooking({ user: { id: user.id } as User });
      bookingRepo.findOne.mockResolvedValue(booking);
      reviewRepo.findOne.mockResolvedValue(null);

      const result = await service.create(
        { bookingId: booking.id, rating: 4, comment: 'Sân đẹp' },
        user,
      );

      expect(result.rating).toBe(4);
      expect(result.comment).toBe('Sân đẹp');
      expect(reviewRepo.save).toHaveBeenCalled();
    });
  });

  describe('listByVenue', () => {
    it('returns items, total, and the average rating rounded to 1 decimal', async () => {
      const venueId = faker.string.uuid();
      reviewRepo.find.mockResolvedValue([
        createMock<Review>({ rating: 5 }),
        createMock<Review>({ rating: 4 }),
      ]);

      const result = await service.listByVenue(venueId);

      expect(reviewRepo.find).toHaveBeenCalledWith({
        where: { venue: { id: venueId } },
        relations: { user: true },
        order: { createdAt: 'DESC' },
      });
      expect(result.total).toBe(2);
      expect(result.averageRating).toBe(4.5);
    });

    it('returns averageRating 0 when there are no reviews', async () => {
      reviewRepo.find.mockResolvedValue([]);
      const result = await service.listByVenue(faker.string.uuid());
      expect(result.total).toBe(0);
      expect(result.averageRating).toBe(0);
    });
  });
});
