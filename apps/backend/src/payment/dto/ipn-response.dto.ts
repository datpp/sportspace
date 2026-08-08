import { ApiProperty } from '@nestjs/swagger';

export class IpnResponseDto {
  @ApiProperty()
  RspCode: string;

  @ApiProperty()
  Message: string;
}
