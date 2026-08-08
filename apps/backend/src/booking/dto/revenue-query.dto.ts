import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class RevenueQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'year'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year'])
  range?: 'day' | 'week' | 'month' | 'year';
}
