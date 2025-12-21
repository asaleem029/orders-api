import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for order status
    await queryRunner.query(`
      CREATE TYPE order_status_enum AS ENUM ('draft', 'confirmed', 'closed');
    `);

    // Create orders table
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'order_status_enum',
            default: "'draft'",
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'total_cents',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for orders
    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_orders_tenant_created_id',
        columnNames: ['tenant_id', 'created_at', 'id'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_orders_tenant_id',
        columnNames: ['tenant_id', 'id'],
      }),
    );

    // Create outbox table
    await queryRunner.createTable(
      new Table({
        name: 'outbox',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'event_type',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'tenant_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'published_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for outbox
    await queryRunner.createIndex(
      'outbox',
      new TableIndex({
        name: 'IDX_outbox_published_event',
        columnNames: ['published_at', 'event_type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('outbox', true);
    await queryRunner.dropTable('orders', true);
    await queryRunner.query(`DROP TYPE IF EXISTS order_status_enum;`);
  }
}

