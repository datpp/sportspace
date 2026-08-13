import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateStaffDto {
  @ApiProperty()
  @IsUUID()
  venueId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fullName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  position: string;
}
