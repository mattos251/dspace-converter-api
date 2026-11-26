import type { FastifyInstance } from 'fastify';
import type { ConversionController } from './ConversionController.js';

export async function conversionRoutes(
  app: FastifyInstance,
  controller: ConversionController,
): Promise<void> {
  app.post('/conversions', (request, reply) => controller.handle(request, reply));
}
