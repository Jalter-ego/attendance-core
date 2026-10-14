import { Controller, Get, Ip, Post } from '@nestjs/common';
import { AllowOnly, CurrentUser } from '../auth/auth.decorators';
import type { StudentPrincipal } from '../auth/types/auth-principal';
import { AttendancesService } from './repo/attendance.service';

@AllowOnly('student')
@Controller('attendance')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Get('today')
  today(@CurrentUser() student: StudentPrincipal) {
    return this.attendancesService.today(student);
  }

  @Post('mark')
  mark(@CurrentUser() student: StudentPrincipal, @Ip() ip: string) {
    return this.attendancesService.markToday(student, ip);
  }

  @Get('me')
  myHistory(@CurrentUser() student: StudentPrincipal) {
    return this.attendancesService.myHistory(student);
  }
}
