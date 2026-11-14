import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService, UNMATCHED_ROUTE } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const pattern: unknown = req.route?.path;
      const route = typeof pattern === 'string' && !pattern.includes('*') ? pattern : UNMATCHED_ROUTE;
      if (route.endsWith('/metrics')) return;
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observe(req.method, route, res.statusCode, seconds);
    });

    next();
  }
}
