import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeStatus } from '@sportspace/shared';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeStatus })
  @IsIn([DisputeStatus.RESOLVED, DisputeStatus.REJECTED])
  status: DisputeStatus.RESOLVED | DisputeStatus.REJECTED;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  resolutionNote: string;

  @ApiPropertyOptional({
    description: 'Số tiền hoàn (VNĐ), chỉ áp dụng khi status=RESOLVED',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  refundAmount?: number;
}
