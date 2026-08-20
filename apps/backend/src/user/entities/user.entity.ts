import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ unique: true })
  email: string;

  // No @ApiProperty() — must never appear in Swagger docs/responses.
  @Column({ select: false })
  passwordHash: string;

  @ApiProperty()
  @Column()
  fullName: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({ nullable: true })
  phone: string;

  @ApiProperty({ enum: Role })
  @Column({ type: 'enum', enum: Role, default: Role.PLAYER })
  role: Role;

  @ApiProperty()
  @Column({ default: false })
  isLocked: boolean;

  // No @ApiProperty() — internal device token, never in Swagger docs/responses.
  @Column({ nullable: true, type: 'varchar' })
  fcmToken: string | null;

  // No @ApiProperty(): the raw token is never stored (only this hash), and
  // this field must never leak into any API response either way — same
  // rule as passwordHash/fcmToken.
  @Column({ type: 'varchar', nullable: true })
  resetPasswordTokenHash: string | null;

  // No @ApiProperty(): internal expiry bookkeeping, same rule as above.
  @Column({ type: 'timestamptz', nullable: true })
  resetPasswordExpiresAt: Date | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
