import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../conversion/errors.js';

export function handleError(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    request.log.warn({ code: error.code }, error.message);
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  const statusCode = (error as FastifyError).statusCode;

  if (statusCode === 413) {
    request.log.warn({ code: 'FILE_TOO_LARGE' }, 'Upload acima do limite configurado');
    return reply.status(413).send({
      error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite permitido.' },
    });
  }

  // Erros de requisição do próprio Fastify/multipart (ex.: content-type errado)
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    request.log.warn({ err: error }, 'Requisição inválida');
    return reply.status(statusCode).send({
      error: { code: 'BAD_REQUEST', message: 'Requisição inválida.' },
    });
  }

  request.log.error({ err: error }, 'Erro não tratado na requisição');
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno durante a conversão.' },
  });
}
