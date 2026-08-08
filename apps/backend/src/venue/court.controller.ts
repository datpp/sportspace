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
import { Role } from '@sportspace/shared';
import { CourtService } from './court.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { CreatePriceRuleDto } from './dto/create-price-rule.dto';
import { SlotQueryDto } from './dto/slot-query.dto';
import { SlotDto } from './dto/slot.dto';
import { Court } from './entities/court.entity';
import { PriceRule } from './entities/price-rule.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('courts')
@Controller('courts')
export class CourtController {
  constructor(private readonly courtService: CourtService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo sân con trong cụm sân' })
  @ApiCreatedResponse({ type: Court })
  create(@Body() dto: CreateCourtDto, @CurrentUser() user: AuthenticatedUser) {
    return this.courtService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách sân con (lọc theo venueId)' })
  @ApiOkResponse({ type: [Court] })
  findAll(@Query('venueId') venueId?: string) {
    return this.courtService.findAll(venueId);
  }

  @Get(':id')
  @ApiOkResponse({ type: Court })
  findOne(@Param('id') id: string) {
    return this.courtService.findOne(id);
  }

  @Get(':id/slots')
  @ApiOperation({ summary: 'Danh sách ô giờ còn trống theo ngày' })
  @ApiOkResponse({ type: [SlotDto] })
  getSlots(@Param('id') id: string, @Query() query: SlotQueryDto) {
    return this.courtService.getSlots(id, query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: Court })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourtDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courtService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.courtService.remove(id, user);
  }

  @Post(':id/price-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm giá theo khung giờ / ngày trong tuần' })
  @ApiCreatedResponse({ type: PriceRule })
  addPriceRule(
    @Param('id') id: string,
    @Body() dto: CreatePriceRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courtService.addPriceRule(id, dto, user);
  }

  @Get(':id/price-rules')
  @ApiOperation({ summary: 'Danh sách giá theo khung giờ' })
  @ApiOkResponse({ type: [PriceRule] })
  listPriceRules(@Param('id') id: string) {
    return this.courtService.listPriceRules(id);
  }

  @Delete(':id/price-rules/:priceRuleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  removePriceRule(
    @Param('id') id: string,
    @Param('priceRuleId') priceRuleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courtService.removePriceRule(id, priceRuleId, user);
  }
}
