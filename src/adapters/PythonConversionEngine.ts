
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import type { FastifyBaseLogger } from 'fastify';
import type { IConversionEngine } from '../conversion/ports.js';
import { ConversionError } from '../conversion/errors.js';

interface PythonConversionEngineOptions {
  pythonBin: string;
  scriptPath: string;
  timeoutMs: number;
  logger: FastifyBaseLogger;
}

export class PythonConversionEngine implements IConversionEngine {
  constructor(private readonly options: PythonConversionEngineOptions) {}

  execute(
    inputPath: string,
    outputDirectory: string,
  ): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const scriptPath = resolve(this.options.scriptPath);

      const child = spawn(
        this.options.pythonBin,
        [scriptPath, inputPath, outputDirectory],
        {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        },
      );

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;

        settled = true;
        clearTimeout(timeout);

        if (error) {
          reject(error);
        } else {
          resolvePromise();
        }
      };

      const timeout = setTimeout(() => {
        child.kill();

        this.options.logger.error({ timeoutMs: this.options.timeoutMs }, 'Tempo limite da conversão excedido');

        finish(
          new ConversionError(
            'A conversão excedeu o tempo limite permitido.',
          ),
        );
      }, this.options.timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout = (stdout + chunk).slice(-8000);
      });

      child.stderr.on('data', (chunk: string) => {
        stderr = (stderr + chunk).slice(-8000);
      });

      child.on('error', (error) => {
        this.options.logger.error({ err: error, pythonBin: this.options.pythonBin }, 'Erro ao iniciar Python');

        finish(
          new ConversionError(
            'Não foi possível iniciar o mecanismo Python.',
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.options.logger.info('Conversão concluída');
          this.options.logger.debug({ stdout }, 'Saída do script Python');

          finish();
          return;
        }

        this.options.logger.error(
          { code, scriptPath, stdout, stderr },
          'Erro na conversão Python',
        );

        finish(new ConversionError());
      });
    });
  }
}
