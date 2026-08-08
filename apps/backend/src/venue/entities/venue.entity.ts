import { User } from '../../user/entities/user.entity';
import { Court } from './court.entity';
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

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => Court, (court) => court.venue)
  courts: Court[];

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'PENDING' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
