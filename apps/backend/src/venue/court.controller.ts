import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SlotQueryDto } from './dto/slot-query.dto';
import { SlotDto } from './dto/slot.dto';

@ApiTags('courts')
@Controller('courts')
export class CourtController {
  @Get(':id/slots')
  @ApiOperation({ summary: 'Danh sách ô giờ còn trống theo ngày' })
  getSlots(@Param('id') _courtId: string, @Query() _query: SlotQueryDto): SlotDto[] {
    return [];
  }
}
