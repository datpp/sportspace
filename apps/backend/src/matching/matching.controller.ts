import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { FindMatchesQueryDto } from './dto/find-matches-query.dto';
import { Match } from './entities/match.entity';
import { MatchParticipant } from './entities/match-participant.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('matches')
@Controller('matches')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo kèo từ 1 booking đã CONFIRMED' })
  @ApiCreatedResponse({ type: Match })
  create(@CurrentUser('id') hostId: string, @Body() dto: CreateMatchDto) {
    return this.matchingService.create(hostId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Tìm kèo đang mở (lọc theo bộ môn)' })
  @ApiOkResponse({ type: [Match] })
  findAll(@Query() query: FindMatchesQueryDto) {
    return this.matchingService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: Match })
  findOne(@Param('id') id: string) {
    return this.matchingService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: Match })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchingService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.matchingService.remove(id, user);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xin ghép kèo' })
  @ApiCreatedResponse({ type: MatchParticipant })
  join(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.matchingService.join(id, userId);
  }

  @Post(':id/participants/:participantId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ kèo duyệt yêu cầu ghép' })
  @ApiCreatedResponse({ type: MatchParticipant })
  acceptParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchingService.acceptParticipant(id, participantId, user);
  }

  @Post(':id/participants/:participantId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ kèo từ chối yêu cầu ghép' })
  @ApiCreatedResponse({ type: MatchParticipant })
  rejectParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchingService.rejectParticipant(id, participantId, user);
  }
}
