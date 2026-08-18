import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAddOnServiceDto } from './create-addon-service.dto';

export class UpdateAddOnServiceDto extends PartialType(
  OmitType(CreateAddOnServiceDto, ['venueId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
