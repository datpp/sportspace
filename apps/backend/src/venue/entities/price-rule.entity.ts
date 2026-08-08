import { ApiProperty } from '@nestjs/swagger';
import { Court } from './court.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('price_rules')
export class PriceRule {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): Court.priceRules already embeds PriceRule, so
  // PriceRule.court would be a circular back-reference — breaks orval's
  // generated mock/type (resolves the cycle with `null`, fails the
  // non-nullable Court type).
  @ManyToOne(() => Court)
  @JoinColumn({ name: 'court_id' })
  court: Court;

  @ApiProperty({ description: '0 = Chủ nhật ... 6 = Thứ 7' })
  @Column({ type: 'int' })
  dayOfWeek: number;

  @ApiProperty()
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty()
  @Column({ type: 'time' })
  endTime: string;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
