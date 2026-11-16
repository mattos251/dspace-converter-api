import { AppError } from './AppError.js';

export class InvalidFileError extends AppError {
  constructor(message = 'Envie um arquivo input-forms.xml válido.') {
    super(message, 'INVALID_FILE', 400);
  }
}
