import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  courtId: string;

  @ApiProperty()
  @IsDateString()
  bookingDate: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'startTime phải theo định dạng HH:mm' })
  startTime: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'endTime phải theo định dạng HH:mm' })
  endTime: string;
}
