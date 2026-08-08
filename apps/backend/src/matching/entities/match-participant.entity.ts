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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Match)
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: MatchParticipantStatus,
    default: MatchParticipantStatus.REQUESTED,
  })
  status: MatchParticipantStatus;

  @CreateDateColumn()
  createdAt: Date;
}
