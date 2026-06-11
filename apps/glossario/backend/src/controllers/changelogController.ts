import { Request, Response } from 'express';
import { db } from '../config/database';
import { decodeHtmlEntities, sanitizeInlineText } from '../utils/sanitizeText';

const repairMojibake = (value: string): string => {
  // Evita "corrigir" palavras válidas em PT-BR (ex.: AÇÃO contém Ã).
  // Só tenta reparo quando há padrão típico de mojibake: Ã/Â seguido
  // de caractere não-ASCII da faixa Latin-1.
  const likelyMojibake = /(?:Ã[-ÿ]|Â[-ÿ])/;
  if (!likelyMojibake.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    return repaired || value;
  } catch {
    return value;
  }
};

const normalizeForCompare = (value: string): string =>
  sanitizeInlineText(
    decodeHtmlEntities(repairMojibake(value))
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[?¿�]+/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
  )
    .toLowerCase();

const toTokenSet = (value: string): Set<string> =>
  new Set(
    normalizeForCompare(value)
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
  );

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
};

const qualityScore = (title: string, body: string): number => {
  const text = `${title}\n${body}`;
  const badCount = (text.match(/[?¿�]/g) || []).length;
  return text.length - badCount * 3;
};

const isNearDuplicate = (
  a: { type: string; title: string; body: string; created_at: string },
  b: { type: string; title: string; body: string; created_at: string },
): boolean => {
  if (a.type !== b.type) return false;

  const dayA = String(a.created_at).slice(0, 10);
  const dayB = String(b.created_at).slice(0, 10);
  if (dayA !== dayB) return false;

  const titleA = toTokenSet(a.title);
  const titleB = toTokenSet(b.title);
  const bodyA = toTokenSet(a.body);
  const bodyB = toTokenSet(b.body);

  const titleSimilarity = jaccard(titleA, titleB);
  const bodySimilarity = jaccard(bodyA, bodyB);
  const hasCorruptedCandidate = /[?¿�]{2,}/.test(a.title + a.body) || /[?¿�]{2,}/.test(b.title + b.body);

  if (hasCorruptedCandidate) {
    return titleSimilarity >= 0.5 && bodySimilarity >= 0.4;
  }

  return titleSimilarity >= 0.6 && bodySimilarity >= 0.55;
};

export const getChangelogs = async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        title,
        body,
        type,
        created_at
      FROM public.update_log
      ORDER BY created_at DESC
      LIMIT 50
    `);

    // Normaliza strings e remove duplicatas visuais (incluindo versão corrompida
    // por encoding) preservando a versão de melhor qualidade.
    const normalizedRows = result.rows.map((row: any) => ({
      ...row,
      title: sanitizeInlineText(repairMojibake(row.title ?? '')),
      body: decodeHtmlEntities(repairMojibake(row.body ?? '')).trim(),
    }));

    const deduped: any[] = [];

    for (const row of normalizedRows) {
      const idx = deduped.findIndex((existing) => isNearDuplicate(existing, row));

      if (idx === -1) {
        deduped.push(row);
        continue;
      }

      const existing = deduped[idx];
      const existingScore = qualityScore(existing.title, existing.body);
      const candidateScore = qualityScore(row.title, row.body);

      if (candidateScore > existingScore) {
        deduped[idx] = row;
      }
    }

    // Fallback de deduplicação exata por chave normalizada.
    const dedupeMap = new Map<string, any>();
    for (const row of result.rows) {
      const title = sanitizeInlineText(repairMojibake(row.title ?? ''));
      const body = decodeHtmlEntities(repairMojibake(row.body ?? '')).trim();
      const key = `${String(row.type || '').toLowerCase()}::${normalizeForCompare(title)}::${normalizeForCompare(body)}`;

      if (!dedupeMap.has(key)) {
        dedupeMap.set(key, {
          ...row,
          title,
          body,
        });
      }
    }

    const exactDeduped = Array.from(dedupeMap.values());
    const finalRows = deduped.length > 0 ? deduped : exactDeduped;
    res.json(finalRows);
  } catch (error) {
    console.error('Erro ao buscar changelogs:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
