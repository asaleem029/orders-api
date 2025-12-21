import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

export const correlationIdStorage = new AsyncLocalStorage<string>();

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const correlationId =
      request.headers['x-request-id'] || request.headers['x-correlation-id'] || uuidv4();

    response.setHeader('X-Request-ID', correlationId);

    return correlationIdStorage.run(correlationId, () => {
      return next.handle().pipe(
        tap(() => {
          // Correlation ID is available in AsyncLocalStorage for logging
        }),
      );
    });
  }
}

