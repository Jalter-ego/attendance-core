import { Controller, Get, Ip, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { assertExcelFile, EXCEL_FIELD, excelUploadOptions } from '../../common/excel/excel-upload';
import { AllowOnly, CurrentUser } from '../auth/auth.decorators';
import type { AdminPrincipal } from '../auth/types/auth-principal';
import { ListStudentsQuery } from './dto/list-students.query';
import { StudentsService } from './repo/student.service';

@AllowOnly('admin')
@Controller()
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('students')
  list(@CurrentUser() admin: AdminPrincipal, @Query() query: ListStudentsQuery) {
    return this.studentsService.listActive(admin, query.search);
  }

  @Post('modules/:moduleId/students/import')
  @UseInterceptors(FileInterceptor(EXCEL_FIELD, excelUploadOptions))
  import(
    @CurrentUser() admin: AdminPrincipal,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Ip() ip: string,
  ) {
    assertExcelFile(file);
    return this.studentsService.importForModule(admin, moduleId, file, ip);
  }
}
