import { BARE_LABEL_STOP_KEYS, normalizeLabelKey } from '../discord/parseDiscordAnnouncement.js';

// Bug real (spec 079, 2026-07-16, bateria de 13 anúncios reais colados do
// Discord): colar texto do cliente Discord no navegador frequentemente perde
// quebras de linha visuais entre labels ("Sistema: Próprio Dias e horários: A
// definir Vagas: 4 jogadores..."). `parseDiscordAnnouncement.ts` assume um
// label por linha — sem isso, o valor de um campo engole o label seguinte
// inteiro. Só usado no caminho de texto colado manual
// (`routes/inbox/import.ts`); o import via JSON preserva `\n` reais da API
// Discord e não precisa/não deve passar por aqui.
//
// Heurística: candidato de até 4 palavras terminando em ":"/"：", precedido de
// espaço (não já início de linha), que normaliza (mesma `normalizeLabelKey`
// do parser — lista única, sem duplicar strings) para um label conhecido de
// `BARE_LABEL_STOP_KEYS` ganha quebra de linha antes. Não mexe em label que já
// está no início da própria linha (idempotente).
const MAX_LABEL_WORDS = 4;

function isKnownLabelCandidate(candidate: string): boolean {
  return BARE_LABEL_STOP_KEYS.has(normalizeLabelKey(candidate));
}

export function normalizeLooseText(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const outLines = lines.map((line) => normalizeLooseLine(line));
  return outLines.join('\n');
}

function normalizeLooseLine(line: string): string {
  // Rótulo:valor colado repetidas vezes na mesma linha. Varre da esquerda pra
  // direita procurando ":"/"：" precedido de espaço cujo texto entre o início
  // da busca (ou a última quebra inserida) e o ":" — últimas 1 a 4 palavras —
  // bate em label conhecido.
  //
  // Guarda contra falso positivo real (spec 079, achado na fixture real:
  // "▬ Regras da Mesa:" virando "▬ Regras da\nMesa:" — "mesa" sozinha bate
  // BARE_LABEL_STOP_KEYS mas é sufixo de um label composto real "Regras da
  // Mesa" que não está na lista canônica). Só quebra a partir do 2º ":" da
  // linha em diante — a primeira ocorrência de ":" nunca é fronteira de
  // grudamento, pois não há "label anterior" pra ela ter engolido. Isso é
  // consistente com o próprio bug relatado (labels grudados SEMPRE aparecem
  // em sequência de 2+ na mesma linha corrida).
  const colonPositions: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ':' || line[i] === '：') colonPositions.push(i);
  }
  if (colonPositions.length < 2) return line;

  let result = '';
  let searchStart = 0;

  for (let ci = 1; ci < colonPositions.length; ci++) {
    const i = colonPositions[ci];
    // texto imediatamente antes do ":" — janela de candidatos por contagem de
    // palavras (1..MAX_LABEL_WORDS) terminando em i.
    const before = line.slice(searchStart, i);
    const words = before.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let matchedWordCount = 0;
    for (let w = 1; w <= Math.min(MAX_LABEL_WORDS, words.length); w++) {
      const candidate = words.slice(words.length - w).join(' ');
      if (isKnownLabelCandidate(candidate)) matchedWordCount = w;
    }
    if (matchedWordCount === 0) continue;

    const candidateWords = words.slice(words.length - matchedWordCount).join(' ');
    // posição do label candidato dentro de `before`: precisa estar precedido
    // por espaço (não ser o próprio início da linha/segmento já quebrado) —
    // senão já está corretamente no início de sua própria linha.
    const labelStartInBefore = before.lastIndexOf(candidateWords);
    if (labelStartInBefore <= 0) continue;
    const charBeforeLabel = before[labelStartInBefore - 1];
    if (!/\s/.test(charBeforeLabel)) continue;

    const absoluteLabelStart = searchStart + labelStartInBefore;
    result += line.slice(searchStart, absoluteLabelStart).trimEnd();
    result += '\n';
    searchStart = absoluteLabelStart;
  }

  result += line.slice(searchStart);
  return result;
}
