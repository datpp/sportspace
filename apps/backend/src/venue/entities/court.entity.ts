import { Venue } from './venue.entity';
import { PriceRule } from './price-rule.entity';
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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @OneToMany(() => PriceRule, (priceRule) => priceRule.court)
  priceRules: PriceRule[];

  @Column()
  name: string;

  @Column()
  sport: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  basePrice: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
