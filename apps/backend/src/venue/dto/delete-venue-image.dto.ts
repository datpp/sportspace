import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteVenueImageDto {
  @ApiProperty()
  @IsString()
  url: string;
}
