import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { IdempotencyService } from './services/idempotency.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ListOrdersResponseDto } from './dto/list-orders-response.dto';
import { OrdersService } from './services/orders.service';

@ApiTags('orders')
@Controller('api/v1/orders')
@UseGuards(TenantGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new draft order (idempotent)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 409, description: 'Idempotency key conflict' })
  async create(
    @Tenant() tenantId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      });
    }

    const requestBody = JSON.stringify(dto);
    const { cached, response } = await this.idempotencyService.checkAndStore(
      tenantId,
      idempotencyKey,
      requestBody,
    );

    if (cached && response) {
      return response;
    }

    const result = await this.ordersService.create(tenantId, dto);
    
    await this.idempotencyService.storeResponse(
      tenantId,
      idempotencyKey,
      requestBody,
      result,
    );

    return result;
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm an order (optimistic locking)' })
  @ApiHeader({ name: 'If-Match', required: true, description: 'Order version' })
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 409, description: 'Version mismatch' })
  async confirm(
    @Tenant() tenantId: string,
    @Param('id') orderId: string,
    @Headers('if-match') ifMatch: string,
    @Body() dto: ConfirmOrderDto,
  ): Promise<OrderResponseDto> {
    if (!ifMatch) {
      throw new BadRequestException({
        code: 'IF_MATCH_REQUIRED',
        message: 'If-Match header is required',
      });
    }

    const version = parseInt(ifMatch.replace(/"/g, ''), 10);
    if (isNaN(version)) {
      throw new BadRequestException({
        code: 'INVALID_VERSION',
        message: 'If-Match header must contain a valid version number',
      });
    }

    return this.ordersService.confirm(tenantId, orderId, version, dto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close an order and write to outbox' })
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async close(
    @Tenant() tenantId: string,
    @Param('id') orderId: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.close(tenantId, orderId);
  }

  @Get()
  @ApiOperation({ summary: 'List orders with keyset pagination' })
  @ApiHeader({ name: 'X-Tenant-Id', required: true })
  @ApiResponse({ status: 200, type: ListOrdersResponseDto })
  async list(
    @Tenant() tenantId: string,
    @Query() query: ListOrdersDto,
  ): Promise<ListOrdersResponseDto> {
    const limit = query.limit || 20;
    return this.ordersService.list(tenantId, limit, query.cursor);
  }
}

