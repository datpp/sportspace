import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCourtDto } from './create-court.dto';

export class UpdateCourtDto extends PartialType(
  OmitType(CreateCourtDto, ['venueId'] as const),
) {}
