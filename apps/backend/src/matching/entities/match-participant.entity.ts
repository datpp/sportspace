import { ApiProperty } from '@nestjs/swagger';
import { MatchParticipantStatus } from '@sportspace/shared';
import { Match } from './match.entity';
import { User } from '../../user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('match_participants')
export class MatchParticipant {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): Match.participants already embeds MatchParticipant,
  // so this would be a circular back-reference — see match.entity.ts.
  @ManyToOne(() => Match)
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ enum: MatchParticipantStatus })
  @Column({
    type: 'enum',
    enum: MatchParticipantStatus,
    default: MatchParticipantStatus.REQUESTED,
  })
  status: MatchParticipantStatus;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
