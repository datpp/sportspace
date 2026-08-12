import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notifications')
export class Notification {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty()
  @Column()
  title: string;

  @ApiProperty()
  @Column()
  body: string;

  @ApiProperty()
  @Column({ default: false })
  isRead: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
