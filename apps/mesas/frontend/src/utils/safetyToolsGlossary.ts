// T5.4 (spec 081): descrições padrão de mercado para ferramentas de segurança e
// avisos de conteúdo mais comuns em RPG. content_warnings/safety_tools são texto
// livre no schema (sem enum) — produção não tinha dado real no momento da
// investigação (SELECT DISTINCT vazio), então o glossário cobre os termos
// conhecidos da comunidade; termos fora daqui caem no fallback (sem descrição extra).
export const SAFETY_TOOL_DESCRIPTIONS: Record<string, string> = {
  'x-card': 'Qualquer jogador pode sinalizar a qualquer momento para pular ou suavizar uma cena, sem precisar explicar o motivo.',
  'linha e véu': '"Linhas" são temas que nunca aparecem na mesa; "véus" são temas que podem existir mas são narrados de forma implícita, sem detalhes.',
  'lua e sol': 'Sinal visual (lua/sol) para indicar se o tom da cena pode ficar mais pesado (lua) ou deve permanecer leve (sol).',
  'check-in': 'Pausas periódicas onde o mestre confirma com o grupo se o conteúdo da sessão está confortável para todos.',
  'script change': 'Ferramenta com cartas (pausa, retrocesso, avanço) para qualquer jogador ajustar o ritmo de uma cena sensível.',
  'open door': 'Qualquer jogador pode se levantar e sair da mesa a qualquer momento, sem necessidade de explicação ou permissão.',
};

export const CONTENT_WARNING_DESCRIPTIONS: Record<string, string> = {
  violência: 'A mesa pode incluir descrições de combate, ferimentos ou violência explícita.',
  'violência gráfica': 'A mesa pode incluir descrições explícitas e detalhadas de violência ou ferimentos.',
  terror: 'A mesa explora temas de horror, medo ou tensão psicológica.',
  morte: 'A mesa pode incluir a morte de personagens (jogadores ou NPCs) como parte da narrativa.',
  'abuso': 'A mesa pode abordar temas de abuso físico, emocional ou psicológico.',
  'temas sexuais': 'A mesa pode incluir referências ou cenas com conteúdo sexual (sem descrição gráfica, salvo aviso à parte).',
  gore: 'A mesa pode incluir descrições gráficas e explícitas de violência extrema ou mutilação.',
  'discriminação': 'A narrativa pode retratar preconceito ou discriminação como parte do enredo (não endossado pela mesa).',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function getSafetyToolDescription(tool: string): string | null {
  return SAFETY_TOOL_DESCRIPTIONS[normalizeKey(tool)] ?? null;
}

export function getContentWarningDescription(warning: string): string | null {
  return CONTENT_WARNING_DESCRIPTIONS[normalizeKey(warning)] ?? null;
}
