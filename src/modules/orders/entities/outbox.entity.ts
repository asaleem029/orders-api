import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('outbox')
@Index(['published_at', 'event_type']) // For polling unpublished events
export class Outbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  event_type: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'text' })
  tenant_id: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

