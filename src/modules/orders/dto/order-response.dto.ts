import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  version: number;

  @ApiProperty({ nullable: true, required: false })
  totalCents?: number | null;

  @ApiProperty()
  createdAt: Date;
}

