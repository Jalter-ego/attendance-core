import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../modules/auth/auth.decorators';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  async scrape(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<string> {
    if (req.headers['x-forwarded-for'] !== undefined) throw new NotFoundException();
    res.setHeader('Content-Type', this.metrics.contentType);
    return this.metrics.render();
  }
}
