import { Controller } from '@nestjs/common';
import { DisputeService } from './dispute.service';

@Controller('dispute')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}
}
