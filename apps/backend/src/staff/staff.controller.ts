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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { ShiftQueryDto } from './dto/shift-query.dto';
import { FindStaffQueryDto } from './dto/find-staff-query.dto';
import { Staff } from './entities/staff.entity';
import { Shift } from './entities/shift.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

@ApiTags('staff')
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MERCHANT, Role.ADMIN)
@ApiBearerAuth()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @ApiOperation({ summary: 'Thêm nhân viên vào cụm sân' })
  @ApiCreatedResponse({ type: Staff })
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách nhân viên theo cụm sân (tìm kiếm/lọc/phân trang)' })
  @ApiPaginatedResponse(Staff)
  findAll(@Query() query: FindStaffQueryDto): Promise<PaginatedDto<Staff>> {
    return this.staffService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: Staff })
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Staff })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.remove(id, user);
  }

  @Post(':id/shifts')
  @ApiOperation({ summary: 'Thêm ca làm cho nhân viên' })
  @ApiCreatedResponse({ type: Shift })
  createShift(
    @Param('id') id: string,
    @Body() dto: CreateShiftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.createShift(id, dto, user);
  }

  @Get(':id/shifts')
  @ApiOperation({ summary: 'Danh sách ca làm của nhân viên' })
  @ApiOkResponse({ type: [Shift] })
  listShifts(@Param('id') id: string, @Query() query: ShiftQueryDto) {
    return this.staffService.listShifts(id, query);
  }

  @Delete(':id/shifts/:shiftId')
  @ApiOperation({ summary: 'Xoá ca làm' })
  removeShift(
    @Param('id') id: string,
    @Param('shiftId') shiftId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.removeShift(id, shiftId, user);
  }
}
