// T4.2 (spec 083) — funcoes puras (subject + html), testaveis sem rede.
// HTML inline simples (decisao registrada em plan.md spec 083): 2 templates
// nao justificam dependencia nova de renderizacao (react-email).

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// So aceita URL absoluta https:, evita injetar javascript:/data:/protocolo
// arbitrario no href caso a env de frontend/slug fique mal configurada.
function safeHttpsUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '#';
  } catch {
    return '#';
  }
}

function wrapLayout(bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: -apple-system, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  ${bodyHtml}
  <p style="color: #666; font-size: 12px; margin-top: 32px;">Artifício RPG — downloads.artificiorpg.com</p>
</body>
</html>`;
}

export interface MaterialRejectedEmailParams {
  authorName: string;
  materialTitle: string;
  categoryLabel: string;
  legalBasis: string | null;
  reason: string;
  editUrl: string;
}

export function materialRejectedEmail(params: MaterialRejectedEmailParams): { subject: string; html: string } {
  const legalBasisHtml = params.legalBasis
    ? `<p style="color: #666; font-size: 14px;">Base: ${escapeHtml(params.legalBasis)}</p>`
    : '';

  const html = wrapLayout(`
    <h1 style="font-size: 20px;">Seu material não foi aprovado</h1>
    <p>Olá, ${escapeHtml(params.authorName)}.</p>
    <p>O material <strong>${escapeHtml(params.materialTitle)}</strong> não foi aprovado pela moderação.</p>
    <p><strong>Categoria:</strong> ${escapeHtml(params.categoryLabel)}</p>
    ${legalBasisHtml}
    <p><strong>Motivo:</strong> ${escapeHtml(params.reason)}</p>
    <p>Você pode editar o material e reenviar para uma nova revisão:</p>
    <p><a href="${escapeHtml(safeHttpsUrl(params.editUrl))}" style="color: #d97706;">Editar e reenviar</a></p>
  `);

  return {
    subject: `Material "${params.materialTitle}" não foi aprovado`,
    html,
  };
}

export interface MaterialApprovedEmailParams {
  authorName: string;
  materialTitle: string;
  publicUrl: string;
}

export function materialApprovedEmail(params: MaterialApprovedEmailParams): { subject: string; html: string } {
  const html = wrapLayout(`
    <h1 style="font-size: 20px;">Seu material foi aprovado</h1>
    <p>Olá, ${escapeHtml(params.authorName)}.</p>
    <p>O material <strong>${escapeHtml(params.materialTitle)}</strong> foi aprovado e já está publicado.</p>
    <p><a href="${escapeHtml(safeHttpsUrl(params.publicUrl))}" style="color: #d97706;">Ver material publicado</a></p>
  `);

  return {
    subject: `Material "${params.materialTitle}" foi aprovado`,
    html,
  };
}
