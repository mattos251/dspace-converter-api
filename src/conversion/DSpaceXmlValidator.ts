import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { InvalidFileError, OutputValidationError } from './errors.js';

export class DSpaceXmlValidator {
  private static readonly MIN_SIZE = 100; // bytes
  private static readonly REQUIRED_ROOT = 'input-forms';
  private static readonly parser = new XMLParser({ processEntities: false, ignoreAttributes: false });
  private static readonly SUSPICIOUS_PATTERNS = [
    /<script/i,
    /<iframe/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onload, etc
    /eval\s*\(/i,
    /base64/i,
  ];

  static validate(content: Buffer, filename: string): void {
    this.validateFilename(filename);
    this.validateMinSize(content);

    const xml = content.toString('utf8');

    this.validateXmlStructure(xml);
    this.validateDSpaceStructure(xml);
    this.validateNoSuspiciousContent(xml);
    this.validateNoDTDOrEntities(xml);
    this.validateRootElement(xml);
  }

  static validateOutput(xml: string): void {
    if (XMLValidator.validate(xml) !== true) {
      throw new OutputValidationError();
    }
  }

  private static validateFilename(filename: string): void {
    if (filename.toLowerCase() !== 'input-forms.xml') {
      throw new InvalidFileError('O arquivo deve se chamar input-forms.xml.');
    }

    // Verifica path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new InvalidFileError('Nome de arquivo inválido.');
    }
  }

  // O tamanho máximo é aplicado no multipart, conforme MAX_FILE_SIZE_MB (app.ts)
  private static validateMinSize(content: Buffer): void {
    if (content.length < this.MIN_SIZE) {
      throw new InvalidFileError('O arquivo é muito pequeno (mínimo 100 bytes).');
    }
  }

  private static validateXmlStructure(xml: string): void {
    if (XMLValidator.validate(xml) !== true) {
      throw new InvalidFileError('O conteúdo enviado não é um XML bem-formado.');
    }
  }

  private static validateDSpaceStructure(xml: string): void {
    // Aceita qualquer root, mas valida presença de elementos DSpace 5
    if (!/<form-definitions/.test(xml) && !/<form\b/.test(xml)) {
      throw new InvalidFileError(
        'O XML não contém estrutura DSpace 5 esperada. Não encontrou <form-definitions> ou <form>.',
      );
    }

    if (!/<form-map/.test(xml) && !/<form-map-ext/.test(xml)) {
      throw new InvalidFileError('O XML não contém <form-map>. Arquivo DSpace 5 inválido.');
    }
  }

  private static validateNoSuspiciousContent(xml: string): void {
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(xml)) {
        throw new InvalidFileError('O arquivo contém conteúdo suspeito e não é suportado.');
      }
    }
  }

  private static validateNoDTDOrEntities(xml: string): void {
    // Bloqueia declarações DOCTYPE com DTD
    if (/<!\s*DOCTYPE\s+\w+\s+SYSTEM/i.test(xml)) {
      throw new InvalidFileError('Declarações DOCTYPE externas não são permitidas.');
    }

    // Bloqueia entidades internas
    if (/<!\s*ENTITY\b/i.test(xml)) {
      throw new InvalidFileError('Declarações de entidades XML não são permitidas.');
    }

    // Bloqueia subconjuntos internos no DOCTYPE
    if (/<!\s*DOCTYPE\b[^[]*\[/i.test(xml)) {
      throw new InvalidFileError('Subconjuntos internos no DOCTYPE não são permitidos.');
    }

    // Bloqueia referências a entidades externas
    if (/<!ENTITY\s+\w+\s+SYSTEM/i.test(xml)) {
      throw new InvalidFileError('Entidades externas não são permitidas.');
    }

    // Bloqueia XXE (XML External Entity)
    if (/SYSTEM\s+["'].*:\/\//i.test(xml)) {
      throw new InvalidFileError('Referências de entidades externas não são permitidas.');
    }
  }

  private static validateRootElement(xml: string): void {
    let parsed: unknown;
    try {
      parsed = this.parser.parse(xml);
    } catch {
      throw new InvalidFileError('Não foi possível interpretar o XML enviado.');
    }

    if (!parsed || typeof parsed !== 'object' || !(this.REQUIRED_ROOT in parsed)) {
      throw new InvalidFileError('O XML não possui a estrutura esperada de input-forms do DSpace 5.');
    }
  }
}
