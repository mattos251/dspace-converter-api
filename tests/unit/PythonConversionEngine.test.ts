import { describe, expect, it } from 'vitest';
import { buildScriptArguments } from '../../src/infrastructure/converters/PythonConversionEngine.js';

describe('buildScriptArguments', () => {
  it('passes --keep-commented-fields when commented fields are kept', () => {
    expect(buildScriptArguments('main.py', 'in.xml', 'out', { keepCommentedFields: true })).toEqual([
      'main.py',
      'in.xml',
      'out',
      '--keep-commented-fields',
    ]);
  });

  it('passes --no-keep-commented-fields when commented fields are removed', () => {
    expect(buildScriptArguments('main.py', 'in.xml', 'out', { keepCommentedFields: false })).toEqual([
      'main.py',
      'in.xml',
      'out',
      '--no-keep-commented-fields',
    ]);
  });
});
