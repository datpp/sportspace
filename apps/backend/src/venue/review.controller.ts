import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { VenueReviewsDto } from './dto/venue-reviews.dto';
import { Review } from './entities/review.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLAYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh giá sân sau khi đã chơi xong' })
  @ApiCreatedResponse({ type: Review })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đánh giá + điểm trung bình theo cụm sân' })
  @ApiOkResponse({ type: VenueReviewsDto })
  findByVenue(@Query('venueId') venueId: string) {
    return this.reviewService.listByVenue(venueId);
  }
}
