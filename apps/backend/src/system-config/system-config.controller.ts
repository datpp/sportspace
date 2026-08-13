import { Controller } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';

@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}
}
