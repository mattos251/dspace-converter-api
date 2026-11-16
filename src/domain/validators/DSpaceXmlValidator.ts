import { XMLValidator } from 'fast-xml-parser';
import { InvalidFileError } from '../errors/InvalidFileError.js';

export class DSpaceXmlValidator {
  private static readonly MIN_SIZE = 100; // bytes
  private static readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly REQUIRED_ROOT = 'input-forms';
  private static readonly SUSPICIOUS_PATTERNS = [
    /<script/i,
    /<iframe/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onload, etc
    /eval\s*\(/i,
    /base64/i,
  ];

  static validate(content: Buffer, filename: string): void {
    try {
      this.validateFilename(filename);
      this.validateSize(content);
      this.validateNotEmpty(content);

      const xml = content.toString('utf8');

      this.validateXmlStructure(xml);
      this.validateDSpaceStructure(xml);
      this.validateNoSuspiciousContent(xml);
      this.validateNoDTDOrEntities(xml);
    } catch (error) {
      if (error instanceof InvalidFileError) {
        console.error(`[DSpaceXmlValidator] ${error.message}`);
      }
      throw error;
    }
  }

  private static validateFilename(filename: string): void {
    if (filename.toLowerCase() !== 'input-forms.xml') {
      const msg = 'O arquivo deve se chamar input-forms.xml.';
      console.error(`[Validator] Erro de nome: ${msg} Recebido: ${filename}`);
      throw new InvalidFileError(msg);
    }

    // Verifica path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      const msg = 'Nome de arquivo inválido.';
      console.error(`[Validator] Path traversal detectado: ${filename}`);
      throw new InvalidFileError(msg);
    }
  }

  private static validateSize(content: Buffer): void {
    if (content.length < this.MIN_SIZE) {
      const msg = 'O arquivo é muito pequeno (mínimo 100 bytes).';
      console.error(`[Validator] Tamanho mínimo: ${content.length} bytes < ${this.MIN_SIZE}`);
      throw new InvalidFileError(msg);
    }

    if (content.length > this.MAX_SIZE) {
      const msg = 'O arquivo excede o tamanho máximo permitido (5MB).';
      console.error(`[Validator] Tamanho máximo: ${content.length} bytes > ${this.MAX_SIZE}`);
      throw new InvalidFileError(msg);
    }
  }

  private static validateNotEmpty(content: Buffer): void {
    if (content.length === 0) {
      const msg = 'O arquivo enviado está vazio.';
      console.error(`[Validator] Arquivo vazio`);
      throw new InvalidFileError(msg);
    }
  }

  private static validateXmlStructure(xml: string): void {
    const validation = XMLValidator.validate(xml);
    if (validation !== true) {
      const msg = 'O conteúdo enviado não é um XML bem-formado.';
      console.error(`[Validator] XML mal-formado:`, validation);
      throw new InvalidFileError(msg);
    }
  }

  private static validateDSpaceStructure(xml: string): void {
    // Aceita qualquer root, mas valida presença de elementos DSpace 5
    if (!/<form-definitions/.test(xml) && !/<form\b/.test(xml)) {
      const msg = 'O XML não contém estrutura DSpace 5 esperada. Não encontrou <form-definitions> ou <form>.';
      console.error(`[Validator] Estrutura DSpace 5 não encontrada`);
      throw new InvalidFileError(msg);
    }

    if (!/<form-map/.test(xml) && !/<form-map-ext/.test(xml)) {
      const msg = 'O XML não contém <form-map>. Arquivo DSpace 5 inválido.';
      console.error(`[Validator] <form-map> não encontrado`);
      throw new InvalidFileError(msg);
    }
  }

  private static validateNoSuspiciousContent(xml: string): void {
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(xml)) {
        const msg = 'O arquivo contém conteúdo suspeito e não é suportado.';
        console.error(`[Validator] Conteúdo suspeito detectado. Padrão: ${pattern}`);
        throw new InvalidFileError(msg);
      }
    }
  }

  private static validateNoDTDOrEntities(xml: string): void {
    // Bloqueia declarações DOCTYPE com DTD
    if (/<!\s*DOCTYPE\s+\w+\s+SYSTEM/i.test(xml)) {
      const msg = 'Declarações DOCTYPE externas não são permitidas.';
      console.error(`[Validator] DOCTYPE externo detectado`);
      throw new InvalidFileError(msg);
    }

    // Bloqueia entidades internas
    if (/<!\s*ENTITY\b/i.test(xml)) {
      const msg = 'Declarações de entidades XML não são permitidas.';
      console.error(`[Validator] Declaração !ENTITY detectada`);
      throw new InvalidFileError(msg);
    }

    // Bloqueia subconjuntos internos no DOCTYPE
    if (/<!\s*DOCTYPE\b[^[]*\[/i.test(xml)) {
      const msg = 'Subconjuntos internos no DOCTYPE não são permitidos.';
      console.error(`[Validator] Subconjunto interno no DOCTYPE detectado`);
      throw new InvalidFileError(msg);
    }

    // Bloqueia referências a entidades externas
    if (/<!ENTITY\s+\w+\s+SYSTEM/i.test(xml)) {
      const msg = 'Entidades externas não são permitidas.';
      console.error(`[Validator] Entidade externa detectada`);
      throw new InvalidFileError(msg);
    }

    // Bloqueia XXE (XML External Entity)
    if (/SYSTEM\s+["'].*:\/\//i.test(xml)) {
      const msg = 'Referências de entidades externas não são permitidas.';
      console.error(`[Validator] XXE (XML External Entity) detectado`);
      throw new InvalidFileError(msg);
    }
  }
}