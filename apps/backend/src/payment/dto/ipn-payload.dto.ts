import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class IpnPayloadDto {
  @ApiProperty()
  @IsString()
  transactionRef: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsString()
  signature: string;
}
