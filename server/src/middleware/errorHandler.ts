import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function errorHandler(
  error: FastifyError,
  _req: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = error.statusCode || (error.message.includes('not found') ? 404 : 400);

  // Return standard JSON error format
  reply.code(statusCode).send({
    ok: false,
    error: error.message || 'Internal Server Error',
    statusCode,
  });
}
