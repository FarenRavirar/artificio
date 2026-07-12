// Validacao de tipo real por magic bytes (T5.2) — nao confia em extensao/MIME
// declarado (mitigacao T5.5). MVP aceita so PDF/MD/DOC(X) (D111 item 10),
// nunca .zip/pacote compactado.

export type AllowedMaterialFileType = 'pdf' | 'md' | 'doc' | 'docx';

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');
// DOCX e um ZIP (PK\x03\x04); DOC legado (OLE2) comeca com D0 CF 11 E0.
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function startsWith(buffer: Buffer, magic: Buffer): boolean {
  return buffer.length >= magic.length && buffer.subarray(0, magic.length).equals(magic);
}

function looksLikePlainText(buffer: Buffer): boolean {
  // Markdown nao tem magic bytes proprios — aceitamos como texto puro se nao
  // houver byte nulo nos primeiros bytes (heuristica padrao p/ distinguir de
  // binario disfarcado de .md).
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  return !sample.includes(0);
}

/**
 * Detecta o tipo real do arquivo pelos magic bytes. Retorna `null` se não
 * corresponder a nenhum dos tipos aceitos no MVP (rejeita, inclusive .zip
 * puro que não seja DOCX).
 */
export function detectAllowedFileType(buffer: Buffer, declaredExtension: string): AllowedMaterialFileType | null {
  const ext = declaredExtension.toLowerCase().replace(/^\./, '');

  if (startsWith(buffer, PDF_MAGIC)) {
    return ext === 'pdf' ? 'pdf' : null;
  }

  if (startsWith(buffer, OLE2_MAGIC)) {
    return ext === 'doc' ? 'doc' : null;
  }

  if (startsWith(buffer, ZIP_MAGIC)) {
    // ZIP puro so e aceito se a extensao declarada for docx (Office OOXML).
    return ext === 'docx' ? 'docx' : null;
  }

  if (ext === 'md' && looksLikePlainText(buffer)) {
    return 'md';
  }

  return null;
}
