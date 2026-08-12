import { ApiProperty } from '@nestjs/swagger';
import { MatchStatus } from '@sportspace/shared';
import { Booking } from '../../booking/entities/booking.entity';
import { User } from '../../user/entities/user.entity';
import { MatchParticipant } from './match-participant.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('matches')
export class Match {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ type: () => Booking })
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'host_id' })
  host: User;

  // Forward direction embeds the array, so it gets @ApiProperty(); the back
  // reference (MatchParticipant.match) stays undecorated to avoid a circular
  // schema — see court.entity.ts for the same pattern (Court.priceRules
  // decorated, PriceRule.court not).
  @ApiProperty({ type: () => [MatchParticipant] })
  @OneToMany(() => MatchParticipant, (participant) => participant.match)
  participants: MatchParticipant[];

  @ApiProperty()
  @Column({ type: 'int' })
  slotsTotal: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  slotsFilled: number;

  @ApiProperty({ required: false, nullable: true })
  @Column({ nullable: true })
  skillLevel: string;

  // varchar, not a real Postgres enum type — the initial migration created
  // this column as plain character varying, and TypeORM can't infer a
  // column type from an enum-typed TS property (reflect-metadata reports
  // `Object`), so `type` must stay explicit here to match the existing
  // schema without a migration.
  @ApiProperty({ enum: MatchStatus })
  @Column({ type: 'varchar', default: MatchStatus.OPEN })
  status: MatchStatus;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
