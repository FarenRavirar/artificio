// Regras de campo da aba Geral, espelho das do servidor: `profile.ts` (PATCH /me:
// username >= 3, /^[a-z0-9_]+$/i) e `me.ts` (display_name >= 2). Validar aqui antes
// de enviar evita o 400 que, antes da spec 106, aparecia a cada tecla (relato do
// Victor: "qualquer coisa que escreva no user name da erro").

export function validateDisplayName(value: string): string | null {
  return value.trim().length >= 2 ? null : 'Use pelo menos 2 caracteres.';
}

export function validateUsername(value: string): string | null {
  const v = value.trim();
  if (v.length < 3) return 'Use pelo menos 3 caracteres.';
  if (!/^[a-z0-9_]+$/i.test(v)) return 'Use apenas letras, números e underscore (_).';
  return null;
}
