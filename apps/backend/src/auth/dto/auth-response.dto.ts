import { Role } from '@sportspace/shared';
import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: Role })
  role: Role;
}
