import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class RevenueTimeseriesQueryDto {
  @ApiPropertyOptional({ enum: ['week', 'month', 'year'] })
  @IsOptional()
  @IsIn(['week', 'month', 'year'])
  range?: 'week' | 'month' | 'year';
}
