import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@sportspace/shared';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(BookingStatus), 'ALL'] as const;

export class MerchantBookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: BookingStatus | 'ALL';

  @ApiPropertyOptional({ description: 'Tìm theo tên/email khách hoặc tên sân' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
