import { Controller, Ip, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { assertExcelFile, EXCEL_FIELD, excelUploadOptions } from '../../common/excel/excel-upload';
import { AllowOnly, CurrentUser } from '../auth/auth.decorators';
import type { AdminPrincipal } from '../auth/types/auth-principal';
import { ClassSessionsService } from './repo/class-session.service';

@AllowOnly('admin')
@Controller('modules/:moduleId/sessions')
export class ClassSessionsController {
  constructor(private readonly classSessionsService: ClassSessionsService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor(EXCEL_FIELD, excelUploadOptions))
  import(
    @CurrentUser() admin: AdminPrincipal,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Ip() ip: string,
  ) {
    assertExcelFile(file);
    return this.classSessionsService.importForModule(admin, moduleId, file, ip);
  }
}
