import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';
import { SystemConfig } from './entities/system-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig])],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
})
export class SystemConfigModule {}
