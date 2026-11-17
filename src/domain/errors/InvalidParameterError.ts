import { AppError } from './AppError.js';

export class InvalidParameterError extends AppError {
  constructor(message: string) {
    super(message, 'INVALID_PARAMETER', 400);
  }
}
