import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Role } from '@sportspace/shared';
import { VenueService } from './venue.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FindVenuesQueryDto } from './dto/find-venues-query.dto';
import { DeleteVenueImageDto } from './dto/delete-venue-image.dto';
import { Venue } from './entities/venue.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

@ApiTags('venues')
@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo cụm sân' })
  @ApiCreatedResponse({ type: Venue })
  create(@CurrentUser('id') ownerId: string, @Body() dto: CreateVenueDto) {
    return this.venueService.create(ownerId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Tìm sân theo vị trí + bộ môn' })
  @ApiOkResponse({ type: [Venue] })
  findAll(@Query() query: FindVenuesQueryDto) {
    return this.venueService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: Venue })
  findOne(@Param('id') id: string) {
    return this.venueService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: Venue })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVenueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.venueService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.venueService.remove(id, user);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt cụm sân (chỉ ADMIN)' })
  @ApiCreatedResponse({ type: Venue })
  approve(@Param('id') id: string) {
    return this.venueService.approve(id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Từ chối cụm sân (chỉ ADMIN)' })
  @ApiCreatedResponse({ type: Venue })
  reject(@Param('id') id: string) {
    return this.venueService.reject(id);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải ảnh lên cho cụm sân (tối đa 8 ảnh)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ type: Venue })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh');
    }
    return this.venueService.addImage(id, user, file);
  }

  @Delete(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xoá một ảnh khỏi cụm sân' })
  @ApiOkResponse({ type: Venue })
  removeImage(
    @Param('id') id: string,
    @Body() dto: DeleteVenueImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.venueService.removeImage(id, user, dto.url);
  }
}
