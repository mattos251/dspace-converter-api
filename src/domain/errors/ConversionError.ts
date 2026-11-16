import { AppError } from './AppError.js';

export class ConversionError extends AppError {
  constructor(message = 'Não foi possível converter o arquivo.') {
    super(message, 'CONVERSION_FAILED', 422);
  }
}
