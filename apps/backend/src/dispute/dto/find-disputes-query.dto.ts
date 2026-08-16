import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeStatus } from '@sportspace/shared';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(DisputeStatus), 'ALL'] as const;

export class FindDisputesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL, default: DisputeStatus.OPEN })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: DisputeStatus | 'ALL';

  @ApiPropertyOptional({ description: 'Tìm theo lý do hoặc người khiếu nại' })
  @IsOptional()
  @IsString()
  q?: string;
}
