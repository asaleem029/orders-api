import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Order } from '../modules/orders/entities/order.entity';
import { Outbox } from '../modules/orders/entities/outbox.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'orders_user',
  password: process.env.DATABASE_PASSWORD || 'orders_password',
  database: process.env.DATABASE_NAME || 'orders_db',
  entities: [Order, Outbox],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

