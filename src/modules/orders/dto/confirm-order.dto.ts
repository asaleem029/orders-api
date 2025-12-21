import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class ConfirmOrderDto {
  @ApiProperty({ example: 1234, description: 'Total amount in cents' })
  @IsInt()
  @IsPositive()
  totalCents: number;
}

