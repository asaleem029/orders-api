import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, LessThan } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { Outbox } from '../entities/outbox.entity';
import { IdempotencyService } from './idempotency.service';
import { EventPublisherService } from '../../../events/event-publisher.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { ConfirmOrderDto } from '../dto/confirm-order.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { ListOrdersResponseDto } from '../dto/list-orders-response.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Outbox)
    private readonly outboxRepository: Repository<Outbox>,
    private readonly idempotencyService: IdempotencyService,
    private readonly eventPublisher: EventPublisherService,
    private readonly dataSource: DataSource,
  ) {}

  async create(tenantId: string, dto: CreateOrderDto): Promise<OrderResponseDto> {
    const order = this.orderRepository.create({
      tenant_id: tenantId,
      status: OrderStatus.DRAFT,
      version: 1,
      total_cents: null,
    });

    const saved = await this.orderRepository.save(order);

    // Publish event
    await this.eventPublisher.publish('orders.created', tenantId, {
      orderId: saved.id,
      tenantId: saved.tenant_id,
      status: saved.status,
      version: saved.version,
      createdAt: saved.created_at,
    });

    return this.toResponseDto(saved);
  }

  async confirm(
    tenantId: string,
    orderId: string,
    version: number,
    dto: ConfirmOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: `Order with ID ${orderId} not found`,
        details: { orderId },
      });
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot confirm order in status ${order.status}`,
        details: { orderId, currentStatus: order.status },
      });
    }

    // Optimistic locking check
    if (order.version !== version) {
      throw new ConflictException({
        code: 'VERSION_MISMATCH',
        message: `Order version mismatch. Expected ${version}, got ${order.version}`,
        details: { orderId, expectedVersion: version, currentVersion: order.version },
      });
    }

    order.status = OrderStatus.CONFIRMED;
    order.total_cents = dto.totalCents;
    order.version += 1;

    const saved = await this.orderRepository.save(order);

    // Publish event
    await this.eventPublisher.publish('orders.confirmed', tenantId, {
      orderId: saved.id,
      tenantId: saved.tenant_id,
      status: saved.status,
      version: saved.version,
      totalCents: saved.total_cents,
    });

    return this.toResponseDto(saved);
  }

  async close(tenantId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: `Order with ID ${orderId} not found`,
        details: { orderId },
      });
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot close order in status ${order.status}. Must be confirmed.`,
        details: { orderId, currentStatus: order.status },
      });
    }

    // Transactional: update order and insert outbox in same transaction
    const result = await this.dataSource.transaction(async (manager) => {
      order.status = OrderStatus.CLOSED;
      order.version += 1;
      const updatedOrder = await manager.save(Order, order);

      const outbox = manager.create(Outbox, {
        event_type: 'orders.closed',
        order_id: orderId,
        tenant_id: tenantId,
        payload: {
          orderId: orderId,
          tenantId: tenantId,
          totalCents: order.total_cents,
          closedAt: new Date().toISOString(),
        },
        published_at: null,
      });

      await manager.save(Outbox, outbox);

      return updatedOrder;
    });

    return this.toResponseDto(result);
  }

  async list(
    tenantId: string,
    limit: number,
    cursor?: string,
  ): Promise<ListOrdersResponseDto> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.tenant_id = :tenantId', { tenantId })
      .orderBy('order.created_at', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .limit(limit + 1); // Fetch one extra to check if there's a next page

    // Keyset pagination: decode cursor if provided
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        const [createdAt, id] = decoded.split('|');
        
        queryBuilder.andWhere(
          '(order.created_at < :createdAt OR (order.created_at = :createdAt AND order.id < :id))',
          {
            createdAt: new Date(createdAt),
            id,
          },
        );
      } catch (error) {
        throw new BadRequestException({
          code: 'INVALID_CURSOR',
          message: 'Invalid pagination cursor',
          details: { cursor },
        });
      }
    }

    const orders = await queryBuilder.getMany();
    const hasNext = orders.length > limit;
    const items = hasNext ? orders.slice(0, limit) : orders;

    // Generate next cursor from last item
    let nextCursor: string | null = null;
    if (hasNext && items.length > 0) {
      const last = items[items.length - 1];
      const cursorData = `${last.created_at.toISOString()}|${last.id}`;
      nextCursor = Buffer.from(cursorData).toString('base64');
    }

    return {
      items: items.map((order) => this.toResponseDto(order)),
      nextCursor,
    };
  }

  private toResponseDto(order: Order): OrderResponseDto {
    return {
      id: order.id,
      tenantId: order.tenant_id,
      status: order.status,
      version: order.version,
      totalCents: order.total_cents ?? undefined,
      createdAt: order.created_at,
    };
  }
}

