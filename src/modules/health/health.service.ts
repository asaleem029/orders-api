import { Injectable, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../config/redis.module';
import Redis from 'ioredis';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async checkReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    checks: {
      database: 'up' | 'down';
      redis: 'up' | 'down';
    };
  }> {
    const checks = {
      database: 'down' as 'up' | 'down',
      redis: 'down' as 'up' | 'down',
    };

    // Check database
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'up';
    } catch (error) {
      checks.database = 'down';
    }

    // Check Redis
    try {
      await this.redis.ping();
      checks.redis = 'up';
    } catch (error) {
      checks.redis = 'down';
    }

    const status =
      checks.database === 'up' && checks.redis === 'up' ? 'ready' : 'not_ready';

    return { status, checks };
  }
}

