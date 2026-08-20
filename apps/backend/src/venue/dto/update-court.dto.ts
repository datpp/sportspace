import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CourtStatus } from '@sportspace/shared';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCourtDto } from './create-court.dto';

export class UpdateCourtDto extends PartialType(
  OmitType(CreateCourtDto, ['venueId'] as const),
) {
  @ApiPropertyOptional({ enum: CourtStatus })
  @IsOptional()
  @IsEnum(CourtStatus)
  status?: CourtStatus;
}
