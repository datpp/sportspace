import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueStatus } from '@sportspace/shared';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(VenueStatus), 'ALL'] as const;

export class MerchantVenuesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: VenueStatus | 'ALL';

  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc địa chỉ' })
  @IsOptional()
  @IsString()
  q?: string;
}
