import { createReadStream } from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ConvertDspaceFiles } from '../../../application/use-cases/ConvertDspaceFiles.js';
import { InvalidFileError } from '../../../domain/errors/InvalidFileError.js';
import { parseKeepCommentedFields } from '../validators/conversion.schema.js';

export class ConversionController {
  constructor(private readonly convertDspaceFiles: ConvertDspaceFiles) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const options = { keepCommentedFields: parseKeepCommentedFields(request.query as Record<string, unknown>) };
    const upload = await request.file();
    if (!upload) throw new InvalidFileError('Nenhum arquivo foi enviado.');
    if (upload.fieldname !== 'file') throw new InvalidFileError('O campo do arquivo deve se chamar "file".');
    const content = await upload.toBuffer();
    const artifact = await this.convertDspaceFiles.execute({ filename: upload.filename, content }, options);

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', 'attachment; filename="dspace-conversion.zip"');
    reply.header('Cache-Control', 'no-store');
    const stream = createReadStream(artifact.archivePath);
    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      await artifact.cleanup();
    };
    reply.raw.once('finish', cleanup);
    reply.raw.once('close', cleanup);
    stream.once('error', cleanup);
    return reply.send(stream);
  }
}
