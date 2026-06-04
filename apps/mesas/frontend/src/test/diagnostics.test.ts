import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordConsoleEntry,
  recordNetworkEntry,
  getDiagnosticsSnapshot,
  clearDiagnostics,
  collectPageContext,
} from '../lib/diagnostics';

describe('diagnostics buffer', () => {
  beforeEach(() => clearDiagnostics());

  it('registra erro de console no snapshot', () => {
    recordConsoleEntry('error', 'TypeError: x is not a function');
    const snap = getDiagnosticsSnapshot();
    expect(snap.consoleErrors.length).toBe(1);
    expect(snap.consoleErrors[0].message).toContain('TypeError');
    expect(snap.consoleErrors[0].level).toBe('error');
  });

  it('descarta mensagem vazia', () => {
    recordConsoleEntry('error', '   ');
    expect(getDiagnosticsSnapshot().consoleErrors.length).toBe(0);
  });

  it('trunca mensagem longa em 500 chars', () => {
    recordConsoleEntry('error', 'a'.repeat(900));
    expect(getDiagnosticsSnapshot().consoleErrors[0].message.length).toBe(500);
  });

  it('limita o buffer a 30 itens (mantem os mais recentes)', () => {
    for (let i = 0; i < 50; i++) recordConsoleEntry('error', `erro ${i}`);
    const snap = getDiagnosticsSnapshot();
    expect(snap.consoleErrors.length).toBe(30);
    expect(snap.consoleErrors[snap.consoleErrors.length - 1].message).toBe('erro 49');
    expect(snap.consoleErrors[0].message).toBe('erro 20');
  });

  it('registra falha de rede com url/metodo/status', () => {
    recordNetworkEntry('/api/v1/gm/tables', 'post', 500);
    const snap = getDiagnosticsSnapshot();
    expect(snap.networkErrors.length).toBe(1);
    expect(snap.networkErrors[0].status).toBe(500);
    expect(snap.networkErrors[0].method).toBe('POST');
  });

  it('snapshot retorna copias independentes do buffer', () => {
    recordConsoleEntry('error', 'a');
    const snap = getDiagnosticsSnapshot();
    snap.consoleErrors.push({ level: 'error', message: 'injetado', ts: 'x' });
    expect(getDiagnosticsSnapshot().consoleErrors.length).toBe(1);
  });
});

describe('collectPageContext', () => {
  it('coleta url/rota/viewport/user agent', () => {
    const ctx = collectPageContext();
    expect(typeof ctx.page_url).toBe('string');
    expect(typeof ctx.route_path).toBe('string');
    expect(ctx.viewport).toMatch(/^\d+x\d+$/);
    expect(typeof ctx.environment).toBe('string');
  });
});
