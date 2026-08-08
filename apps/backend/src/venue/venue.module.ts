import { Module } from '@nestjs/common';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';
import { CourtController } from './court.controller';

@Module({
  controllers: [VenueController, CourtController],
  providers: [VenueService],
})
export class VenueModule {}
