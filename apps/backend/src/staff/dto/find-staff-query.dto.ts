import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindStaffQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsUUID()
  venueId: string;

  @ApiPropertyOptional({ description: '"true" hoặc "false"' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc số điện thoại' })
  @IsOptional()
  @IsString()
  q?: string;
}
