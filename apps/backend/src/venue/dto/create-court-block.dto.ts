import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Matches, MinLength } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateCourtBlockDto {
  @ApiProperty()
  @IsDateString()
  blockDate: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'startTime phải theo định dạng HH:mm' })
  startTime: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'endTime phải theo định dạng HH:mm' })
  endTime: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason: string;
}
