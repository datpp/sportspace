import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueStatus } from '@sportspace/shared';
import { IsEnum, IsOptional } from 'class-validator';

export class AdminVenuesQueryDto {
  @ApiPropertyOptional({ enum: VenueStatus, default: VenueStatus.PENDING })
  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;
}
