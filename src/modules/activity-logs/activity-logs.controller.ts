import { Controller, Get, Query } from '@nestjs/common';
import { AllowOnly } from '../auth/auth.decorators';
import { ListActivityLogsQuery } from './dto/list-activity-logs.query';
import { ActivityLogsService } from './repo/activity-log.service';

// Los estudiantes no tienen acceso al historial general (RF-10)
@AllowOnly('admin')
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  list(@Query() query: ListActivityLogsQuery) {
    return this.activityLogsService.list(query);
  }
}
