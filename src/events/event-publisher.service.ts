import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { correlationIdStorage } from '../common/interceptors/correlation-id.interceptor';

export interface EventEnvelope {
  id: string;
  type: string;
  source: string;
  tenantId: string;
  time: string;
  schemaVersion: string;
  traceId?: string;
  data: Record<string, any>;
}

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  async publish(eventType: string, tenantId: string, data: Record<string, any>): Promise<void> {
    const correlationId = correlationIdStorage.getStore();
    
    const envelope: EventEnvelope = {
      id: uuidv4(),
      type: eventType,
      source: 'orders-service',
      tenantId,
      time: new Date().toISOString(),
      schemaVersion: '1',
      traceId: correlationId,
      data,
    };

    // Mock Pulsar publishing - in production, use actual Pulsar client
    this.logger.log(`[MOCK] Publishing event: ${eventType}`, {
      envelope,
      correlationId,
    });

    // In production, this would be:
    // await this.pulsarProducer.send({
    //   data: Buffer.from(JSON.stringify(envelope)),
    // });
  }
}

