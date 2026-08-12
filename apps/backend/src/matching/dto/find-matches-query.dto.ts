import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FindMatchesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sport?: string;
}
