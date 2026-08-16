import {
  Body,
  Controller,
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
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { FindDisputesQueryDto } from './dto/find-disputes-query.dto';
import { Dispute } from './entities/dispute.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

@ApiTags('disputes')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo khiếu nại cho một đơn đặt sân của chính mình' })
  @ApiCreatedResponse({ type: Dispute })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDisputeDto,
  ): Promise<Dispute> {
    return this.disputeService.create(userId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Danh sách khiếu nại (tìm kiếm/lọc/phân trang)' })
  @ApiPaginatedResponse(Dispute)
  findAll(@Query() query: FindDisputesQueryDto): Promise<PaginatedDto<Dispute>> {
    return this.disputeService.findAll(query);
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Xử lý khiếu nại (chấp nhận/từ chối, có thể hoàn tiền)' })
  @ApiOkResponse({ type: Dispute })
  resolve(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    return this.disputeService.resolve(id, adminId, dto);
  }
}
