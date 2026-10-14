import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Tenant } from './repo/tenant.model';
import { TenantsService } from './repo/tenant.service';

@Module({
  imports: [SequelizeModule.forFeature([Tenant])],
  providers: [TenantsService],
  exports: [SequelizeModule, TenantsService],
})
export class TenantsModule {}
