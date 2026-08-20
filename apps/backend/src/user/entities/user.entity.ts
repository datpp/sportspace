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

  // select: false is what actually keeps this out of API responses (no
  // ClassSerializerInterceptor is registered, so @ApiProperty()'s absence
  // alone does not stop it from being selected and serialized) — same
  // mechanism as passwordHash above. resetPassword() only needs this in a
  // WHERE clause, never in a SELECT, so this is safe.
  @Column({ type: 'varchar', nullable: true, select: false })
  resetPasswordTokenHash: string | null;

  // select: false — same reasoning as resetPasswordTokenHash above.
  @Column({ type: 'timestamptz', nullable: true, select: false })
  resetPasswordExpiresAt: Date | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
