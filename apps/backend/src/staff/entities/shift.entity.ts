import { ApiProperty } from '@nestjs/swagger';
import { Staff } from './staff.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('shifts')
export class Shift {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): same circular-reference rule as PriceRule.court.
  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @ApiProperty()
  @Column({ type: 'date' })
  shiftDate: string;

  @ApiProperty()
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty()
  @Column({ type: 'time' })
  endTime: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
