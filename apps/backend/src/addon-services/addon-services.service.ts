import { Injectable } from '@nestjs/common';
import { CreateAddonServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddonServiceDto } from './dto/update-addon-service.dto';

@Injectable()
export class AddonServicesService {
  create(createAddonServiceDto: CreateAddonServiceDto) {
    return 'This action adds a new addonService';
  }

  findAll() {
    return `This action returns all addonServices`;
  }

  findOne(id: number) {
    return `This action returns a #${id} addonService`;
  }

  update(id: number, updateAddonServiceDto: UpdateAddonServiceDto) {
    return `This action updates a #${id} addonService`;
  }

  remove(id: number) {
    return `This action removes a #${id} addonService`;
  }
}
