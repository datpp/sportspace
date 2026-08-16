import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindCourtsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({ description: 'Tìm theo tên sân hoặc bộ môn' })
  @IsOptional()
  @IsString()
  q?: string;
}
