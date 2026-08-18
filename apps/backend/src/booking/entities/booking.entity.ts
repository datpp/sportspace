import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, PaymentStatus } from '@sportspace/shared';
import { Court } from '../../venue/entities/court.entity';
import { User } from '../../user/entities/user.entity';
import { decimalTransformer } from '../../database/decimal.transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export class BookingPaymentSummary {
  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ type: 'number', nullable: true })
  refundAmount: number | null;
}

export class BookingServiceSummary {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;
}

@Index('uq_booking_slot', ['court', 'bookingDate', 'startTime'], {
  unique: true,
  where: `status IN ('PENDING','CONFIRMED')`,
})
@Entity('bookings')
export class Booking {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ type: () => Court })
  @ManyToOne(() => Court)
  @JoinColumn({ name: 'court_id' })
  court: Court;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty()
  @Column({ type: 'date' })
  bookingDate: string;

  @ApiProperty()
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty()
  @Column({ type: 'time' })
  endTime: string;

  @ApiProperty({ enum: BookingStatus })
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  @ApiProperty({ type: () => BookingPaymentSummary, required: false })
  payment?: BookingPaymentSummary;

  @ApiProperty({ type: () => [BookingServiceSummary], required: false })
  services?: BookingServiceSummary[];

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
