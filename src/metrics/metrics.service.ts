import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

export const UNMATCHED_ROUTE = 'unmatched';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly requests = new Counter({
    name: 'http_requests_total',
    help: 'Peticiones HTTP atendidas por el backend',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  private readonly duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Latencia de las peticiones HTTP, por ruta',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  observe(method: string, route: string, status: number, seconds: number): void {
    const labels = { method, route, status: String(status) };
    this.requests.inc(labels);
    this.duration.observe(labels, seconds);
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
