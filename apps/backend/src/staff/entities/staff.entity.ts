import { ApiProperty } from '@nestjs/swagger';
import { Venue } from '../../venue/entities/venue.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('staff')
export class Staff {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): mirrors Court.venue / PriceRule.court — avoids a
  // circular reference in the orval-generated type (Venue never embeds
  // Staff, but keeping the same "don't expose the parent back-ref" rule
  // used across this codebase keeps the generated client shape consistent).
  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @ApiProperty()
  @Column()
  fullName: string;

  @ApiProperty()
  @Column()
  phone: string;

  @ApiProperty()
  @Column()
  position: string;

  @ApiProperty()
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
