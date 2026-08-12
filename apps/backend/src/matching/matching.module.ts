import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { Match } from './entities/match.entity';
import { MatchParticipant } from './entities/match-participant.entity';
import { Booking } from '../booking/entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match, MatchParticipant, Booking])],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
