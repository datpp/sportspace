import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsPositive,
  Matches,
  Max,
  Min,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreatePriceRuleDto {
  @ApiProperty({
    description: '0 = Chủ nhật ... 6 = Thứ 7 (theo Date.getUTCDay())',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'startTime phải theo định dạng HH:mm' })
  startTime: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'endTime phải theo định dạng HH:mm' })
  endTime: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  price: number;
}
