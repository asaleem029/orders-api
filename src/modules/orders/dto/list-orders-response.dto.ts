import { ApiProperty } from '@nestjs/swagger';
import { OrderResponseDto } from './order-response.dto';

export class ListOrdersResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  items: OrderResponseDto[];

  @ApiProperty({ nullable: true, required: false })
  nextCursor?: string | null;
}

