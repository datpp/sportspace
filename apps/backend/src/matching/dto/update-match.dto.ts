import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// Deliberately not PartialType(CreateMatchDto): bookingId must never be
// reassignable through update — that would let a host repoint an existing
// match to any booking without the ownership/CONFIRMED checks create() does.
export class UpdateMatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  slotsTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skillLevel?: string;
}
