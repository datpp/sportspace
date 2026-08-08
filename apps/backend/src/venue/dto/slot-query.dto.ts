import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class SlotQueryDto {
  @ApiProperty()
  @IsDateString()
  date: string;
}
