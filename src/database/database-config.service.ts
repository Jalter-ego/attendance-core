import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeOptionsFactory, SequelizeModuleOptions } from '@nestjs/sequelize';

@Injectable()
export class DatabaseConfigService implements SequelizeOptionsFactory {
  constructor(private configService: ConfigService) { }

  createSequelizeOptions(): SequelizeModuleOptions {
    return {
      dialect: 'postgres',
      replication: {
        read: [
          {
            host: this.configService.get<string>('DB_READ_HOST'),
            port: this.configService.get<number>('DB_READ_PORT'),
            username: this.configService.get<string>('DB_READ_USERNAME'),
            password: this.configService.get<string>('DB_READ_PASSWORD'),
            database: this.configService.get<string>('DB_READ_NAME'),
          }
        ],
        write: {
          host: this.configService.get<string>('DB_WRITE_HOST'),
          port: this.configService.get<number>('DB_WRITE_PORT'),
          username: this.configService.get<string>('DB_WRITE_USERNAME'),
          password: this.configService.get<string>('DB_WRITE_PASSWORD'),
          database: this.configService.get<string>('DB_WRITE_NAME'),
        },
      },
      pool: {
        max: 1,
        min: 0,
        idle: 10000,
        evict: 10000,
        acquire: 20000,
      },
      dialectOptions:
        this.configService.get<string>('DB_SSL') !== 'false'
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
      autoLoadModels: true,
      synchronize: false,
      logging: console.log,
    };
  }
}
