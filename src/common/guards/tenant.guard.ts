import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Extract tenant from X-Tenant-Id header (simpler for exercise)
    // In production, extract from JWT Bearer token
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new UnauthorizedException({
        code: 'TENANT_REQUIRED',
        message: 'Tenant ID is required. Provide X-Tenant-Id header.',
      });
    }

    // Attach tenant to request for use in controllers/services
    request.tenantId = tenantId;
    return true;
  }
}

