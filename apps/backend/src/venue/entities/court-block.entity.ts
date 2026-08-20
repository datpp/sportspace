import { ApiProperty } from '@nestjs/swagger';
import { Court } from './court.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('court_blocks')
export class CourtBlock {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): same circular-reference rule as Shift.staff.
  @ManyToOne(() => Court)
  @JoinColumn({ name: 'court_id' })
  court: Court;

  @ApiProperty()
  @Column({ type: 'date' })
  blockDate: string;

  @ApiProperty()
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty()
  @Column({ type: 'time' })
  endTime: string;

  @ApiProperty()
  @Column({ type: 'text' })
  reason: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
