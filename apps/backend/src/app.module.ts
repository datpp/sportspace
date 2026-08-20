import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MatchingModule } from './matching/matching.module';
import { VenueModule } from './venue/venue.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { NotificationModule } from './notification/notification.module';
import { RedisModule } from './redis/redis.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UserModule } from './user/user.module';
import { StaffModule } from './staff/staff.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { DisputeModule } from './dispute/dispute.module';
import { AddonServicesModule } from './addon-services/addon-services.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot({ cronJobs: process.env.NODE_ENV !== 'test' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'sportspace'),
        password: config.get<string>('DB_PASSWORD', 'sportspace'),
        database: config.get<string>('DB_NAME', 'sportspace'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    AuthModule,
    MatchingModule,
    VenueModule,
    BookingModule,
    PaymentModule,
    NotificationModule,
    RedisModule,
    RealtimeModule,
    UserModule,
    StaffModule,
    SystemConfigModule,
    DisputeModule,
    AddonServicesModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
