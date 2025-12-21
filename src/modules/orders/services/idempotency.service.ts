import { Injectable, Inject, ConflictException } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../config/redis.module';

@Injectable()
export class IdempotencyService {
  private readonly TTL_SECONDS = 3600; // 1 hour

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async checkAndStore(
    tenantId: string,
    key: string,
    requestBody: string,
  ): Promise<{ cached: boolean; response?: any }> {
    const redisKey = `idempotency:${tenantId}:${key}`;
    
    const existing = await this.redis.get(redisKey);
    
    if (existing) {
      const cached = JSON.parse(existing);
      
      // Check if request body matches
      if (cached.requestBody !== requestBody) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          message: 'Idempotency key already used with different request body',
          details: { idempotencyKey: key },
        });
      }
      
      return { cached: true, response: cached.response };
    }
    
    return { cached: false };
  }

  async storeResponse(
    tenantId: string,
    key: string,
    requestBody: string,
    response: any,
  ): Promise<void> {
    const redisKey = `idempotency:${tenantId}:${key}`;
    const value = JSON.stringify({
      requestBody,
      response,
      createdAt: new Date().toISOString(),
    });
    
    await this.redis.setex(redisKey, this.TTL_SECONDS, value);
  }
}

