import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Tenant } from '../tenants/repo/tenant.model';
import { User } from './repo/user.model';
import { UsersService } from './repo/user.service';
import { UsersController } from './users.controller';

@Module({
  imports: [SequelizeModule.forFeature([User, Tenant])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [SequelizeModule, UsersService],
})
export class UsersModule {}
