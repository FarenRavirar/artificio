import { describe, expect, it } from 'vitest';
import { materialApprovedEmail, materialRejectedEmail } from './templates.js';

describe('materialRejectedEmail', () => {
  it('inclui categoria, base legal e motivo no corpo', () => {
    const result = materialRejectedEmail({
      authorName: 'Fulano',
      materialTitle: 'Aventura X',
      categoryLabel: 'Violação de direitos autorais',
      legalBasis: 'Lei 9.610/98 — Direitos Autorais',
      reason: 'Conteúdo protegido sem autorização.',
      editUrl: 'https://downloads.artificiorpg.com/painel/materiais/123/editar',
    });

    expect(result.subject).toContain('Aventura X');
    expect(result.html).toContain('Violação de direitos autorais');
    expect(result.html).toContain('Lei 9.610/98');
    expect(result.html).toContain('Conteúdo protegido sem autorização.');
    expect(result.html).toContain('https://downloads.artificiorpg.com/painel/materiais/123/editar');
  });

  it('omite bloco de base legal quando null', () => {
    const result = materialRejectedEmail({
      authorName: 'Fulano',
      materialTitle: 'Aventura X',
      categoryLabel: 'Link quebrado',
      legalBasis: null,
      reason: 'Link não resolve.',
      editUrl: 'https://downloads.artificiorpg.com/painel/materiais/123/editar',
    });

    expect(result.html).not.toContain('Base:');
  });

  it('escapa HTML no nome/titulo/motivo (evita XSS no e-mail)', () => {
    const result = materialRejectedEmail({
      authorName: '<script>alert(1)</script>',
      materialTitle: 'Aventura <b>X</b>',
      categoryLabel: 'Outro',
      legalBasis: null,
      reason: '"motivo" com aspas',
      editUrl: 'https://downloads.artificiorpg.com/painel/materiais/123/editar',
    });

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('rejeita editUrl com protocolo nao-https (javascript:) e usa fallback seguro', () => {
    const result = materialRejectedEmail({
      authorName: 'Fulano',
      materialTitle: 'Aventura X',
      categoryLabel: 'Outro',
      legalBasis: null,
      reason: 'motivo',
      editUrl: 'javascript:alert(1)',
    });

    expect(result.html).not.toContain('javascript:');
    expect(result.html).toContain('href="#"');
  });

  it('rejeita editUrl invalida/malformada e usa fallback seguro', () => {
    const result = materialRejectedEmail({
      authorName: 'Fulano',
      materialTitle: 'Aventura X',
      categoryLabel: 'Outro',
      legalBasis: null,
      reason: 'motivo',
      editUrl: 'nao-e-uma-url',
    });

    expect(result.html).toContain('href="#"');
  });
});

describe('materialApprovedEmail', () => {
  it('inclui titulo e link publico', () => {
    const result = materialApprovedEmail({
      authorName: 'Fulano',
      materialTitle: 'Aventura X',
      publicUrl: 'https://downloads.artificiorpg.com/materiais/aventura-x',
    });

    expect(result.subject).toContain('Aventura X');
    expect(result.html).toContain('https://downloads.artificiorpg.com/materiais/aventura-x');
  });
});
