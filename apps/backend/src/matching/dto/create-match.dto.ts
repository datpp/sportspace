import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateMatchDto {
  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  slotsTotal: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skillLevel?: string;
}
