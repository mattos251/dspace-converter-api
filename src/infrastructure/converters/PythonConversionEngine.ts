
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import type { IConversionEngine } from '../../domain/interfaces/IConversionEngine.js';
import { ConversionError } from '../../domain/errors/ConversionError.js';

interface PythonConversionEngineOptions {
  pythonBin: string;
  scriptPath: string;
  timeoutMs: number;
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

        process.stderr.write(
          '[conversion] Tempo limite da conversão excedido.\n',
        );

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
        process.stderr.write(
          `[conversion] Erro ao iniciar Python: ${error.message}\n`,
        );

        finish(
          new ConversionError(
            'Não foi possível iniciar o mecanismo Python.',
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          process.stdout.write(
            `[conversion] Conversão concluída.\n${stdout}\n`,
          );

          finish();
          return;
        }

        process.stderr.write(
          '\n========== ERRO NA CONVERSÃO ==========\n' +
          `Código: ${code}\n` +
          `Script: ${scriptPath}\n` +
          `STDOUT:\n${stdout}\n` +
          `STDERR:\n${stderr}\n` +
          '=======================================\n',
        );

        finish(new ConversionError());
      });
    });
  }
}
