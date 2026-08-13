import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';
import { AdminController } from './admin.controller';
import { CourtController } from './court.controller';
import { Venue } from './entities/venue.entity';
import { Court } from './entities/court.entity';
import { PriceRule } from './entities/price-rule.entity';
import { Review } from './entities/review.entity';
import { CourtService } from './court.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { Booking } from '../booking/entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue, Court, PriceRule, Review, Booking]),
  ],
  controllers: [VenueController, CourtController, AdminController, ReviewController],
  providers: [VenueService, CourtService, ReviewService],
  exports: [VenueService],
})
export class VenueModule {}
