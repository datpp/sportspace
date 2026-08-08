import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { JoinMatchDto } from './dto/join-match.dto';

@ApiTags('matches')
@Controller('matches')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo kèo từ 1 booking đã CONFIRMED' })
  create(@Body() dto: CreateMatchDto) {
    return this.matchingService.create('', dto);
  }

  @Get()
  findAll() {
    return this.matchingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchingService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matchingService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.matchingService.remove(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Xin ghép kèo' })
  join(@Param('id') id: string, @Body() _dto: JoinMatchDto) {
    return this.matchingService.join(id, '');
  }
}
