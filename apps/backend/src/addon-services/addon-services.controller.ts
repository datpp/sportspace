import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AddonServicesService } from './addon-services.service';
import { CreateAddonServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddonServiceDto } from './dto/update-addon-service.dto';

@Controller('addon-services')
export class AddonServicesController {
  constructor(private readonly addonServicesService: AddonServicesService) {}

  @Post()
  create(@Body() createAddonServiceDto: CreateAddonServiceDto) {
    return this.addonServicesService.create(createAddonServiceDto);
  }

  @Get()
  findAll() {
    return this.addonServicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.addonServicesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAddonServiceDto: UpdateAddonServiceDto) {
    return this.addonServicesService.update(+id, updateAddonServiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.addonServicesService.remove(+id);
  }
}
