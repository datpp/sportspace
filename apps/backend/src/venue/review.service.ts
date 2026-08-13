import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus } from '@sportspace/shared';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { Booking } from '../booking/entities/booking.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateReviewDto, user: AuthenticatedUser): Promise<Review> {
    const booking = await this.dataSource.getRepository(Booking).findOne({
      where: { id: dto.bookingId },
      relations: { user: true, court: { venue: true } },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    if (booking.user.id !== user.id) {
      throw new ForbiddenException('Bạn không thể đánh giá booking của người khác');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Chỉ có thể đánh giá booking đã xác nhận');
    }
    if (new Date(booking.bookingDate) > new Date()) {
      throw new BadRequestException('Chỉ có thể đánh giá sau khi đã chơi xong');
    }
    const existing = await this.reviewRepo.findOne({ where: { booking: { id: booking.id } } });
    if (existing) {
      throw new BadRequestException('Booking này đã được đánh giá');
    }

    const review = this.reviewRepo.create({
      venue: booking.court.venue,
      user: booking.user,
      booking,
      rating: dto.rating,
      comment: dto.comment,
    });
    return this.reviewRepo.save(review);
  }
}
