import { Injectable } from '@nestjs/common';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { Match } from './entities/match.entity';
import { MatchParticipant } from './entities/match-participant.entity';

@Injectable()
export class MatchingService {
  create(_hostId: string, _dto: CreateMatchDto): Match {
    throw new Error('Not implemented');
  }

  findAll(): Match[] {
    return [];
  }

  findOne(_id: string): Match | null {
    return null;
  }

  update(_id: string, _dto: UpdateMatchDto): Match {
    throw new Error('Not implemented');
  }

  remove(_id: string): void {
    throw new Error('Not implemented');
  }

  join(_matchId: string, _userId: string): MatchParticipant {
    throw new Error('Not implemented');
  }
}
