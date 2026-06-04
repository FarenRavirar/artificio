const DRAFT_VERSION = 1;
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface DraftPayload<T> {
  version: number;
  updatedAt: number;
  data: T;
}

/**
 * Utilitário production-safe para gerenciar drafts no localStorage
 * - Versionamento para evitar incompatibilidades
 * - Expiração automática de drafts antigos
 * - Tratamento robusto de erros
 */
export const draftStorage = {
  /**
   * Salva um draft no localStorage com versionamento
   */
  save<T>(key: string, data: T): void {
    const payload: DraftPayload<T> = {
      version: DRAFT_VERSION,
      updatedAt: Date.now(),
      data,
    };

    try {
      const serialized = JSON.stringify(payload);
      localStorage.setItem(key, serialized);
    } catch (err) {
      console.error('[draftStorage] Erro ao salvar draft:', err);
      // Falha silenciosa - não quebra a UX se localStorage estiver cheio
    }
  },

  /**
   * Carrega um draft do localStorage com validação de versão e idade
   * Retorna null se:
   * - Draft não existe
   * - Versão incompatível
   * - Draft expirado (> 7 dias)
   * - Erro de parsing
   */
  load<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const payload: DraftPayload<T> = JSON.parse(raw);

      // Validar estrutura
      if (!payload.version || !payload.updatedAt || !payload.data) {
        console.warn('[draftStorage] Draft com estrutura inválida, ignorando');
        this.clear(key);
        return null;
      }

      // Validar versão
      if (payload.version !== DRAFT_VERSION) {
        console.warn(
          `[draftStorage] Versão incompatível (esperado: ${DRAFT_VERSION}, encontrado: ${payload.version}), ignorando draft`
        );
        this.clear(key);
        return null;
      }

      // Validar idade
      const age = Date.now() - payload.updatedAt;
      if (age > MAX_DRAFT_AGE_MS) {
        console.warn('[draftStorage] Draft expirado (> 7 dias), ignorando');
        this.clear(key);
        return null;
      }

      return payload.data;
    } catch (err) {
      console.error('[draftStorage] Erro ao carregar draft:', err);
      // Limpar draft corrompido
      this.clear(key);
      return null;
    }
  },

  /**
   * Remove um draft do localStorage
   */
  clear(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error('[draftStorage] Erro ao limpar draft:', err);
    }
  },

  /**
   * Verifica se existe um draft válido (sem carregar os dados)
   */
  exists(key: string): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;

      const payload = JSON.parse(raw);
      
      // Validar versão e idade sem carregar dados completos
      if (payload.version !== DRAFT_VERSION) return false;
      
      const age = Date.now() - payload.updatedAt;
      if (age > MAX_DRAFT_AGE_MS) {
        this.clear(key);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },
};
