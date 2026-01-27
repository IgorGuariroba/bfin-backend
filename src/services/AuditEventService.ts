import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';

type PrismaLikeClient = PrismaClient | Prisma.TransactionClient;

export interface AuditEventInput {
  userId: string;
  accountId: string;
  eventType: string;
  simulationId?: string;
  payload?: Prisma.InputJsonValue;
}

export class AuditEventService {
  private getClient(client?: PrismaLikeClient): PrismaLikeClient {
    return client ?? prisma;
  }

  async writeEvent(input: AuditEventInput, client?: PrismaLikeClient) {
    const db = this.getClient(client);

    return db.auditEvent.create({
      data: {
        user_id: input.userId,
        account_id: input.accountId,
        simulation_id: input.simulationId,
        event_type: input.eventType,
        payload: input.payload,
      },
    });
  }
}

export const auditEventService = new AuditEventService();
