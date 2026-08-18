import { PartialType } from '@nestjs/swagger';
import { CreateAddonServiceDto } from './create-addon-service.dto';

export class UpdateAddonServiceDto extends PartialType(CreateAddonServiceDto) {}
