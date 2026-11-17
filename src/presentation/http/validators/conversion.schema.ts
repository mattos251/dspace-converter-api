import { InvalidParameterError } from '../../../domain/errors/InvalidParameterError.js';
import { DEFAULT_CONVERSION_OPTIONS } from '../../../domain/value-objects/ConversionOptions.js';

export const conversionFileField = 'file';
export const acceptedInputFilename = 'input-forms.xml';
export const keepCommentedFieldsParam = 'keepCommentedFields';

/**
 * Lê o parâmetro booleano `keepCommentedFields` da query string.
 * Ausente = valor padrão; aceita apenas "true" ou "false".
 */
export function parseKeepCommentedFields(query: Record<string, unknown>): boolean {
  const value = query[keepCommentedFieldsParam];

  if (value === undefined) return DEFAULT_CONVERSION_OPTIONS.keepCommentedFields;
  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new InvalidParameterError(`O parâmetro ${keepCommentedFieldsParam} deve ser "true" ou "false".`);
}
