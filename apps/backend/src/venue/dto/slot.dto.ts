import { ApiProperty } from '@nestjs/swagger';

export class SlotDto {
  @ApiProperty()
  startTime: string;

  @ApiProperty()
  endTime: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  available: boolean;
}
