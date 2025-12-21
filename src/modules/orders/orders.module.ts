import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './services/orders.service';
import { IdempotencyService } from './services/idempotency.service';
import { Order } from './entities/order.entity';
import { Outbox } from './entities/outbox.entity';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Outbox]),
    EventsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, IdempotencyService],
  exports: [OrdersService],
})
export class OrdersModule {}

