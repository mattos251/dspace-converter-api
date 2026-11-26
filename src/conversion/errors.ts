export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidFileError extends AppError {
  constructor(message = 'Envie um arquivo input-forms.xml válido.') {
    super(message, 'INVALID_FILE', 400);
  }
}

export class ConversionError extends AppError {
  constructor(message = 'Não foi possível converter o arquivo.') {
    super(message, 'CONVERSION_FAILED', 422);
  }
}

export class OutputValidationError extends AppError {
  constructor(message = 'A conversão não gerou todos os arquivos esperados.') {
    super(message, 'OUTPUT_VALIDATION_FAILED', 500);
  }
}
