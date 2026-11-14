import { Controller, Get } from '@nestjs/common';
import { AllowOnly } from '../modules/auth/auth.decorators';
import { PlanUsageService } from './plan-usage.service';

@AllowOnly('admin')
@Controller('plan')
export class PlanController {
  constructor(private readonly usage: PlanUsageService) {}

  @Get('usage')
  getUsage() {
    return this.usage.summary();
  }
}
