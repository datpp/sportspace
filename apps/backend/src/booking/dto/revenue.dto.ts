import { ApiProperty } from '@nestjs/swagger';

export class RevenueDto {
  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  totalBookings: number;
}
