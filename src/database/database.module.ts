import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DatabaseConfigService } from './database-config.service';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      useClass: DatabaseConfigService,
    }),
  ],
})
export class DatabaseModule {}
