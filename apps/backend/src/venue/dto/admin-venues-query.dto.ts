import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueStatus } from '@sportspace/shared';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(VenueStatus), 'ALL'] as const;

export class AdminVenuesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL, default: VenueStatus.PENDING })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: VenueStatus | 'ALL';

  @ApiPropertyOptional({
    description: 'Tìm theo tên, địa chỉ, hoặc chủ sở hữu',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tỉnh/thành' })
  @IsOptional()
  @IsString()
  province?: string;
}
