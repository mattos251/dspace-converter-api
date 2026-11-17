import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/main/app.js';
import { PythonConversionEngine } from '../../src/infrastructure/converters/PythonConversionEngine.js';

const inputForms = `<?xml version="1.0" encoding="UTF-8"?>
<input-forms>
  <form-map>
    <name-map collection-handle="123456789/1" form-name="Graduacao"/>
  </form-map>
  <form-definitions>
    <form name="Graduacao">
      <page number="1">
        <field>
          <dc-element>contributor</dc-element>
          <dc-qualifier>author</dc-qualifier>
          <repeatable>true</repeatable>
          <label>Autor</label>
          <input-type>onebox</input-type>
          <hint>Nome do autor</hint>
          <required></required>
        </field>
        <!--
        <field>
          <dc-element>identifier</dc-element>
          <dc-qualifier>uri</dc-qualifier>
          <repeatable>false</repeatable>
          <label>URI</label>
          <input-type>onebox</input-type>
          <hint>Link</hint>
          <required></required>
        </field>
        -->
      </page>
    </form>
  </form-definitions>
  <form-value-pairs>
    <value-pairs value-pairs-name="common_types" dc-term="type">
      <pair><displayed-value>Artigo</displayed-value><stored-value>Artigo</stored-value></pair>
    </value-pairs>
  </form-value-pairs>
</input-forms>
`;

const pythonBin = process.env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3');
const converterScript = resolve('converter', 'main.py');

function multipartPayload(content: string) {
  const boundary = 'dspace-converter-test-boundary';
  const payload = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="input-forms.xml"',
    'Content-Type: text/xml',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('commented fields with the real Python engine', () => {
  let workspace: string;
  const engine = new PythonConversionEngine({ pythonBin, scriptPath: converterScript, timeoutMs: 60_000 });

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'dspace-converter-commented-'));
  });

  afterAll(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  async function convert(options: { keepCommentedFields: boolean }): Promise<string> {
    const runDirectory = await mkdtemp(join(workspace, 'run-'));
    const inputPath = join(runDirectory, 'input-forms.xml');
    const outputDirectory = join(runDirectory, 'output');
    await writeFile(inputPath, inputForms);
    await mkdir(outputDirectory);

    await engine.execute(inputPath, outputDirectory, options);
    return readFile(join(outputDirectory, 'submission-forms.xml'), 'utf8');
  }

  it('keeps the commented field when keepCommentedFields is true', async () => {
    const output = await convert({ keepCommentedFields: true });

    expect(output).toContain('<dc-element>identifier</dc-element>');
    expect(output).toContain('<dc-element>contributor</dc-element>');
  });

  it('removes the commented field when keepCommentedFields is false', async () => {
    const output = await convert({ keepCommentedFields: false });

    expect(output).not.toContain('identifier');
    expect(output).toContain('<dc-element>contributor</dc-element>');
  });
});

describe('POST /api/v1/conversions with keepCommentedFields', () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it('answers 400 with INVALID_PARAMETER for a non-boolean value', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/conversions?keepCommentedFields=sim',
      ...multipartPayload(inputForms),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PARAMETER',
        message: 'O parâmetro keepCommentedFields deve ser "true" ou "false".',
      },
    });
  });

  it.each([
    ['/api/v1/conversions?keepCommentedFields=true'],
    ['/api/v1/conversions?keepCommentedFields=false'],
    ['/api/v1/conversions'],
  ])('converts the file for %s', async (url) => {
    const response = await app.inject({ method: 'POST', url, ...multipartPayload(inputForms) });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/zip');
  });
});
