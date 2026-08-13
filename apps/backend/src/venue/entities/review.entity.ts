import { ApiProperty } from '@nestjs/swagger';
import { Venue } from './venue.entity';
import { User } from '../../user/entities/user.entity';
import { Booking } from '../../booking/entities/booking.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('reviews')
export class Review {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ type: () => Venue })
  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('uq_review_booking', { unique: true })
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Column({ type: 'int' })
  rating: number;

  @ApiProperty({ required: false, nullable: true })
  @Column({ nullable: true })
  comment: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
