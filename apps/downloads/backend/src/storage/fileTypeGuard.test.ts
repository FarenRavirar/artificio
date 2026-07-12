import { describe, it, expect } from 'vitest';
import { detectAllowedFileType } from './fileTypeGuard';

// T5.2 — validacao por magic bytes, nao so extensao (mitigacao T5.5).

describe('detectAllowedFileType', () => {
  it('aceita PDF real com extensao pdf', () => {
    const buffer = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('resto do arquivo')]);
    expect(detectAllowedFileType(buffer, 'pdf')).toBe('pdf');
  });

  it('rejeita PDF real com extensao forjada como docx', () => {
    const buffer = Buffer.from('%PDF-1.7\nresto do arquivo');
    expect(detectAllowedFileType(buffer, 'docx')).toBeNull();
  });

  it('aceita DOC legado (OLE2) com extensao doc', () => {
    const buffer = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from('resto')]);
    expect(detectAllowedFileType(buffer, 'doc')).toBe('doc');
  });

  it('aceita DOCX (zip OOXML) com extensao docx', () => {
    const buffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('resto')]);
    expect(detectAllowedFileType(buffer, 'docx')).toBe('docx');
  });

  it('rejeita zip puro disfarcado de docx quando extensao nao bate mesmo assim', () => {
    const buffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('resto')]);
    expect(detectAllowedFileType(buffer, 'zip')).toBeNull();
  });

  it('aceita markdown como texto puro', () => {
    const buffer = Buffer.from('# titulo\n\nconteudo markdown');
    expect(detectAllowedFileType(buffer, 'md')).toBe('md');
  });

  it('rejeita binario disfarcado de md (byte nulo nos primeiros bytes)', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectAllowedFileType(buffer, 'md')).toBeNull();
  });

  it('rejeita extensao nao suportada mesmo com conteudo valido', () => {
    const buffer = Buffer.from('%PDF-1.7\nresto');
    expect(detectAllowedFileType(buffer, 'exe')).toBeNull();
  });
});
