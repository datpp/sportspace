import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'int', default: 24 })
  cancellationFullRefundHours: number;

  @ApiProperty()
  @Column({ type: 'int', default: 2 })
  cancellationPartialRefundHours: number;

  @ApiProperty()
  @Column({ type: 'int', default: 50 })
  cancellationPartialRefundPercent: number;

  @ApiProperty()
  @Column({ type: 'int', default: 10 })
  platformCommissionPercent: number;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
