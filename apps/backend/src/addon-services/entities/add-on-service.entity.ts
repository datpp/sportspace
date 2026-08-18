import { ApiProperty } from '@nestjs/swagger';
import { Venue } from '../../venue/entities/venue.entity';
import { decimalTransformer } from '../../database/decimal.transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('add_on_services')
export class AddOnService {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): mirrors Staff.venue / Court.venue — avoids a
  // circular reference in the orval-generated type.
  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

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
