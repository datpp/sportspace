import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonServicesService } from './addon-services.service';
import { AddonServicesController } from './addon-services.controller';
import { AddOnService } from './entities/add-on-service.entity';
import { BookingServiceItem } from './entities/booking-service-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AddOnService, BookingServiceItem])],
  controllers: [AddonServicesController],
  providers: [AddonServicesService],
})
export class AddonServicesModule {}
