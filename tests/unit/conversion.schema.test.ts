import { describe, expect, it } from 'vitest';
import { parseKeepCommentedFields } from '../../src/presentation/http/validators/conversion.schema.js';
import { InvalidParameterError } from '../../src/domain/errors/InvalidParameterError.js';

describe('parseKeepCommentedFields', () => {
  it('uses true when the parameter is absent', () => {
    expect(parseKeepCommentedFields({})).toBe(true);
  });

  it('accepts "true" and "false"', () => {
    expect(parseKeepCommentedFields({ keepCommentedFields: 'true' })).toBe(true);
    expect(parseKeepCommentedFields({ keepCommentedFields: 'false' })).toBe(false);
  });

  it.each([[''], ['TRUE'], ['1'], ['0'], ['sim']])('rejects %j', (value) => {
    expect(() => parseKeepCommentedFields({ keepCommentedFields: value })).toThrow(InvalidParameterError);
  });

  it('rejects a repeated parameter', () => {
    expect(() => parseKeepCommentedFields({ keepCommentedFields: ['true', 'false'] })).toThrow(
      InvalidParameterError,
    );
  });
});
