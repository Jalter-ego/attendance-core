import { Controller, Get, Query } from '@nestjs/common';
import { AllowOnly, CurrentUser } from '../auth/auth.decorators';
import type { AdminPrincipal } from '../auth/types/auth-principal';
import { ListActivityLogsQuery } from './dto/list-activity-logs.query';
import { ActivityLogsService } from './repo/activity-log.service';

// Los estudiantes no tienen acceso al historial general (RF-10)
@AllowOnly('admin')
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  list(@CurrentUser() admin: AdminPrincipal, @Query() query: ListActivityLogsQuery) {
    return this.activityLogsService.list(admin, query);
  }
}
