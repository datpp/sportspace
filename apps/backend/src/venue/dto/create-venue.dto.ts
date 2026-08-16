import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VIETNAM_PROVINCES } from '@sportspace/shared';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CreateVenueDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsLatitude()
  lat: number;

  @ApiProperty()
  @IsLongitude()
  lng: number;

  @ApiProperty({ enum: VIETNAM_PROVINCES })
  @IsIn(VIETNAM_PROVINCES)
  province: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
