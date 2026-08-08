import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateCourtDto {
  @ApiProperty()
  @IsUUID()
  venueId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  sport: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  basePrice: number;
}
