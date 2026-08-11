import { ApiProperty } from '@nestjs/swagger';

export class RevenueTimeseriesPointDto {
  @ApiProperty({
    description: "'YYYY-MM-DD' cho range week/month, 'YYYY-MM' cho range year",
  })
  bucket: string;

  @ApiProperty()
  revenue: number;

  @ApiProperty()
  bookings: number;
}
