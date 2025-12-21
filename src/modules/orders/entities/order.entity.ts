import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  CLOSED = 'closed',
}

@Entity('orders')
@Index(['tenant_id', 'created_at', 'id']) // Composite index for keyset pagination
@Index(['tenant_id', 'id']) // For tenant-scoped lookups
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  tenant_id: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'int', nullable: true })
  total_cents: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

