import { Body, Controller, Get, Ip, Put, Query, StreamableFile } from '@nestjs/common';
import { attachmentDisposition, EXCEL_MIME } from '../../common/excel/excel-writer';
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

  // RF-17: la vista general como .xlsx, con los mismos filtros que `GET /attendances`
  @Get('export')
  async export(@CurrentUser() admin: AdminPrincipal, @Query() query: AttendanceOverviewQuery) {
    const { buffer, filename } = await this.attendanceAdminService.exportOverview(admin, query);
    return new StreamableFile(buffer, {
      type: EXCEL_MIME,
      disposition: attachmentDisposition(filename),
      length: buffer.length,
    });
  }

  @Put()
  update(@CurrentUser() admin: AdminPrincipal, @Body() dto: UpdateAttendanceDto, @Ip() ip: string) {
    return this.attendanceAdminService.update(admin, dto, ip);
  }
}
