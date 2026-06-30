/**
 * WS3 — Assistente LLM para parse de anúncios Discord com baixa confiança.
 *
 * Chama a API DeepSeek (deepseek-chat) com o texto bruto da mensagem e um schema
 * de extração. O retorno é normalizado via Zod (payload externo = unknown até schema).
 * Em caso de falha/timeout, retorna null → o parser usa o resultado determinístico.
 *
 * Segurança:
 * - A key DeepSeek é buscada do accounts via getSecret (cache 5 min).
 * - NUNCA logar a key ou o plaintext do corpo da requisição.
 * - Timeout de 15s p/ não travar o lote de parse.
 */
import { z } from 'zod';
import { getSecret } from '../services/adminSecrets';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const LLM_TIMEOUT_MS = 15000;

/** Schema Zod p/ validar o retorno da LLM — payload externo, sem confiança. */
const llmResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }),
  })),
});

/** Schema do JSON que a LLM deve retornar (extração de campos do anúncio). */
const extractedFieldsSchema = z.object({
  title: z.string().optional(),
  system_hint: z.string().optional(),
  day_of_week: z.string().optional(),
  start_time: z.string().optional(),
  slots_total: z.number().int().positive().optional(),
  slots_open: z.number().int().nonnegative().optional(),
  price_type: z.enum(['gratuita', 'paga']).optional(),
  price_value: z.number().optional(),
  contact_url: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

export type LlmExtractedFields = z.infer<typeof extractedFieldsSchema>;

interface LlmAssistResult {
  extracted: LlmExtractedFields;
  model: string;
}

export function minimizeAnnouncementForLlm(rawText: string): string {
  return rawText
    .replace(/<@!?\d+>/g, '<@user>')
    .replace(/<@&\d+>/g, '<@role>')
    .replace(/<#\d+>/g, '<#channel>')
    .replace(/https?:\/\/[^\s<>"']+/g, (url) => {
      if (/forms\.gle\/|docs\.google\.com\/forms\//i.test(url)) return '[form-url]';
      if (/discord\.gg\/|discord(?:app)?\.com\/invite\//i.test(url)) return '[discord-invite]';
      if (/chat\.whatsapp\.com\/|wa\.me\//i.test(url)) return '[whatsapp-url]';
      return '[url-removida]';
    })
    .slice(0, 3000);
}

/**
 * Remove cercas de markdown (```json … ```) de um retorno de LLM via busca por
 * índice — linear, sem o backtracking super-linear do regex anterior (ReDoS).
 * Se não houver cerca, devolve o texto trimado intacto.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  // Pula a primeira linha da cerca de abertura (```/```json + EOL opcional).
  const firstEol = trimmed.indexOf('\n');
  const body = firstEol === -1 ? trimmed.slice(3) : trimmed.slice(firstEol + 1);

  // Corta na cerca de fechamento, se existir.
  const closeIdx = body.lastIndexOf('```');
  return (closeIdx === -1 ? body : body.slice(0, closeIdx)).trim();
}

/**
 * Envia o texto bruto de um anúncio para a API DeepSeek e extrai campos estruturados.
 *
 * @param rawText — texto bruto da mensagem (sanitizado, sem markup Discord).
 * @param existingFields — campos já extraídos pelo parser determinístico (usados como contexto).
 * @returns campos extraídos + model, ou null se falhar/timeout.
 */
export async function assistDiscordParse(
  rawText: string,
  existingFields: Record<string, unknown>,
  model = 'deepseek-chat',
): Promise<LlmAssistResult | null> {
  const apiKey = await getSecret('deepseek_api_key');
  if (!apiKey) return null;

  const systemPrompt = [
    'Você é um extrator de informações de anúncios de mesas de RPG em português.',
    'Extraia APENAS os campos solicitados. Se um campo não estiver presente, omita-o.',
    'Retorne APENAS um objeto JSON válido, sem texto adicional, sem markdown.',
    'day_of_week: dia da semana em português (segunda, terça, quarta, quinta, sexta, sábado, domingo).',
    'start_time: horário no formato HH:MM (24h).',
    'slots_total: número total de vagas. slots_open: vagas disponíveis.',
    'price_type: "gratuita" ou "paga". price_value: valor numérico em reais.',
    'contact_url: URL de formulário, Discord ou WhatsApp.',
    'system_hint: nome do sistema de RPG (ex.: D&D 5E, Tormenta20, Pathfinder 2E).',
    'title: título ou resumo curto do anúncio.',
    'description: descrição completa ou parcial do anúncio, em português.',
  ].join('\n');

  const userPrompt = [
    'Anúncio de mesa de RPG:',
    minimizeAnnouncementForLlm(rawText),
    '',
    'Campos já identificados (use como ponto de partida):',
    JSON.stringify(existingFields, null, 2),
    '',
    'Retorne APENAS o JSON com os campos extraídos.',
  ].join('\n');

  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[llmAssist] DeepSeek API HTTP ${res.status}`);
      return null;
    }

    const body = await res.json();
    const parsed = llmResponseSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[llmAssist] resposta da API fora do schema esperado');
      return null;
    }

    const content = parsed.data.choices[0]?.message?.content;
    if (!content) return null;

    // Normaliza o JSON do retorno — payload externo, sem confiança
    let extractedJson: unknown;
    try {
      // Extrai JSON de dentro de markdown code fences sem regex: o padrão antigo
      // (`(?:json)?[ \t]*\r?\n?([\s\S]*?)```) tinha backtracking super-linear
      // (ReDoS, Sonor L127). Busca textual por índice é linear e equivalente.
      extractedJson = JSON.parse(stripCodeFence(content));
    } catch {
      console.warn('[llmAssist] retorno da LLM não é JSON válido');
      return null;
    }

    const extracted = extractedFieldsSchema.safeParse(extractedJson);
    if (!extracted.success) {
      console.warn('[llmAssist] campos extraídos fora do schema:', extracted.error.issues.slice(0, 3));
      return null;
    }

    return { extracted: extracted.data, model };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[llmAssist] timeout');
    } else {
      console.warn('[llmAssist] erro:', error instanceof Error ? error.message : 'unknown');
    }
    return null;
  }
}
