import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { Staff } from './entities/staff.entity';
import { Shift } from './entities/shift.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, Shift])],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
