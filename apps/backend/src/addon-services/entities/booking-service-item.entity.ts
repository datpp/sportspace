import { ApiProperty } from '@nestjs/swagger';
import { Booking } from '../../booking/entities/booking.entity';
import { AddOnService } from './add-on-service.entity';
import { decimalTransformer } from '../../database/decimal.transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Table name 'booking_service_items', not 'booking_services': that name is
// already taken by an orphaned entity/table from the initial scaffold
// (src/booking/entities/booking-service.entity.ts) unrelated to this module.
@Entity('booking_service_items')
export class BookingServiceItem {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): back-reference to the parent Booking, same rule as
  // Court.venue / Staff.venue — avoids a circular type in the generated client.
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ApiProperty({ type: () => AddOnService })
  @ManyToOne(() => AddOnService)
  @JoinColumn({ name: 'add_on_service_id' })
  addOnService: AddOnService;

  @ApiProperty()
  @Column({ type: 'int' })
  quantity: number;

  // Snapshot of AddOnService.price at booking time — a later price change
  // must not retroactively alter historical bookings' totals.
  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
