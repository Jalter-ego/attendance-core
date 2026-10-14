import { Body, Controller, Get, Ip, Put, Query } from '@nestjs/common';
import { AllowOnly, CurrentUser } from '../auth/auth.decorators';
import type { AdminPrincipal } from '../auth/types/auth-principal';
import { AttendanceOverviewQuery } from './dto/attendance-overview.query';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AttendanceAdminService } from './repo/attendance-admin.service';

@AllowOnly('admin')
@Controller('attendances')
export class AttendanceAdminController {
  constructor(private readonly attendanceAdminService: AttendanceAdminService) {}

  @Get()
  overview(@CurrentUser() admin: AdminPrincipal, @Query() query: AttendanceOverviewQuery) {
    return this.attendanceAdminService.overview(admin, query);
  }

  @Put()
  update(@CurrentUser() admin: AdminPrincipal, @Body() dto: UpdateAttendanceDto, @Ip() ip: string) {
    return this.attendanceAdminService.update(admin, dto, ip);
  }
}
