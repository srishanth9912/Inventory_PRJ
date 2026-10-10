import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function errorHandler(
  error: FastifyError,
  _req: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode =
    error.statusCode ||
    (error.message?.includes('not found') ? 404 : error.message?.includes('Unauthorized') ? 401 : 400);

  // If internal 500 error, sanitize user message
  const clientMessage =
    statusCode >= 500
      ? 'An unexpected error occurred. Please try again later.'
      : error.message || 'Request failed';

  reply.code(statusCode).send({
    ok: false,
    error: clientMessage,
    statusCode,
  });
}

