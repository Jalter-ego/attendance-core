import { Module } from '@nestjs/common';
import { InstitutionModule } from './institution/institution.module';
import { HealthController } from './health/health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AcademicModulesModule } from './modules/academic-modules/academic-modules.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { AttendancesModule } from './modules/attendances/attendances.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClassSessionsModule } from './modules/class-sessions/class-sessions.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule,
    InstitutionModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    AcademicModulesModule,
    StudentsModule,
    ClassSessionsModule,
    AttendancesModule,
    ActivityLogsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
