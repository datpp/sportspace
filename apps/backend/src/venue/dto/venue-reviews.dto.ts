import { ApiProperty } from '@nestjs/swagger';
import { Review } from '../entities/review.entity';

export class VenueReviewsDto {
  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: () => [Review] })
  items: Review[];
}
