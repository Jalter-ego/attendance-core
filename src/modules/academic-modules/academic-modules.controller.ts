import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AllowOnly, CurrentUser } from '../auth/auth.decorators';
import type { AdminPrincipal } from '../auth/types/auth-principal';
import { ActivateModuleDto } from './dto/activate-module.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { AcademicModulesService } from './repo/academic-module.service';

@AllowOnly('admin')
@Controller('modules')
export class AcademicModulesController {
  constructor(private readonly academicModulesService: AcademicModulesService) {}

  @Post()
  create(@CurrentUser() admin: AdminPrincipal, @Body() dto: CreateModuleDto) {
    return this.academicModulesService.create(admin, dto.name);
  }

  @Get()
  list(@CurrentUser() admin: AdminPrincipal) {
    return this.academicModulesService.list(admin.tenantId);
  }

  @Get('active')
  findActive(@CurrentUser() admin: AdminPrincipal) {
    return this.academicModulesService.findActive(admin.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.academicModulesService.findOne(admin.tenantId, id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @CurrentUser() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: ActivateModuleDto,
    @Ip() ip: string,
  ) {
    return this.academicModulesService.activate(admin, id, ip);
  }
}
