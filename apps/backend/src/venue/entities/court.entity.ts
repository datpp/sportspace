import { ApiProperty } from '@nestjs/swagger';
import { Venue } from './venue.entity';
import { PriceRule } from './price-rule.entity';
import { decimalTransformer } from '../../database/decimal.transformer';
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

@Entity('courts')
export class Court {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): Venue.courts already embeds Court, so Court.venue would
  // be a circular back-reference — breaks orval's generated mock/type (it
  // resolves the cycle with `null`, which fails the non-nullable Court type).
  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @ApiProperty({ type: () => [PriceRule] })
  @OneToMany(() => PriceRule, (priceRule) => priceRule.court)
  priceRules: PriceRule[];

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Column()
  sport: string;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  basePrice: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
