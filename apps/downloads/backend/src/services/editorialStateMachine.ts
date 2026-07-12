import type { DownloadEditorialState } from '../db/types';

// Maquina de estados editoriais (T3.3, spec 072 F4). Transicoes fixas e
// explicitas — nenhuma rota grava editorial_state fora desta funcao, para
// garantir que estado invalido nunca entra no banco.

const ALLOWED_TRANSITIONS: Record<DownloadEditorialState, DownloadEditorialState[]> = {
  draft: ['in_review'],
  in_review: ['published', 'rejected'],
  published: ['withdrawn'],
  rejected: ['in_review'], // reenvio (T4.4): preserva dados, exige nova revisao
  withdrawn: [],
};

export class InvalidEditorialTransitionError extends Error {
  constructor(readonly from: DownloadEditorialState, readonly to: DownloadEditorialState) {
    super(`Transição inválida de "${from}" para "${to}".`);
    this.name = 'InvalidEditorialTransitionError';
  }
}

export function assertValidTransition(from: DownloadEditorialState, to: DownloadEditorialState): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidEditorialTransitionError(from, to);
  }
}

export function canTransition(from: DownloadEditorialState, to: DownloadEditorialState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
