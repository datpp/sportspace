import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class BookingServiceInputDto {
  @ApiProperty()
  @IsUUID()
  addOnServiceId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}
