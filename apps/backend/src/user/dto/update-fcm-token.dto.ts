import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateFcmTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  fcmToken: string;
}
