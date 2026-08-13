import { ApiProperty } from '@nestjs/swagger';
import { DisputeStatus } from '@sportspace/shared';
import { Booking } from '../../booking/entities/booking.entity';
import { User } from '../../user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('disputes')
export class Dispute {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ type: () => Booking })
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'raised_by_id' })
  raisedBy: User;

  @ApiProperty()
  @Column({ type: 'text' })
  reason: string;

  @ApiProperty({ enum: DisputeStatus })
  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @ApiProperty({ required: false, nullable: true, type: () => User })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
