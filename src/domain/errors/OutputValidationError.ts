import { AppError } from './AppError.js';

export class OutputValidationError extends AppError {
  constructor(message = 'A conversão não gerou todos os arquivos esperados.') {
    super(message, 'OUTPUT_VALIDATION_FAILED', 500);
  }
}
