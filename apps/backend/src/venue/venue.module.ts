import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';
import { CourtController } from './court.controller';
import { Venue } from './entities/venue.entity';
import { Court } from './entities/court.entity';
import { PriceRule } from './entities/price-rule.entity';
import { Review } from './entities/review.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, Court, PriceRule, Review])],
  controllers: [VenueController, CourtController],
  providers: [VenueService],
})
export class VenueModule {}
