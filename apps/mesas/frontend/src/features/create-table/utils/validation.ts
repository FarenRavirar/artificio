import type { FormState } from '../types/createTable.types';
import type { SessionSchedule } from '../../../components/SessionRepeater';
import type { ContactFormEntry } from '../../../components/ContactsFormBlock';

/**
 * Validators reutilizáveis - retornam null se válido, string de erro se inválido
 */
export const validators = {
  title: (v: string): string | null => {
    if (!v || v.trim().length === 0) return 'Título obrigatório';
    if (v.length < 3) return 'Título muito curto (mínimo 3 caracteres)';
    if (v.length > 100) return 'Título muito longo (máximo 100 caracteres)';
    return null;
  },

  description: (v: string): string | null => {
    if (!v || v.trim().length === 0) return 'Descrição obrigatória';
    if (v.length < 10) return 'Descrição muito curta (mínimo 10 caracteres)';
    if (v.length > 2000) return 'Descrição muito longa (máximo 2000 caracteres)';
    return null;
  },

  systemId: (v: string): string | null => {
    if (!v || v.trim().length === 0) return 'Selecione um sistema';
    return null;
  },

  sessions: (list: SessionSchedule[]): string | null => {
    if (list.length === 0) return 'Adicione pelo menos uma sessão';

    let hasFlexibleSchedule = false;
    for (let i = 0; i < list.length; i++) {
      const session = list[i];
      if (session.day_of_week === 'to_define' || !session.start_time) {
        hasFlexibleSchedule = true;
        break;
      }
    }

    if (hasFlexibleSchedule && list.length > 1) {
      return 'Use apenas uma sessão quando dia ou horário estiver a definir';
    }
    
    // Validar cada sessão
    for (let i = 0; i < list.length; i++) {
      const session = list[i];
      if (!session.day_of_week) return `Sessão ${i + 1}: dia da semana obrigatório`;
      if (session.day_of_week === 'to_define' || !session.start_time) continue;
      if (!session.start_time) return `Sessão ${i + 1}: horário de início obrigatório`;
      if (!session.end_time) return `Sessão ${i + 1}: horário de término obrigatório`;
    }
    
    return null;
  },

  contacts: (list: ContactFormEntry[]): string | null => {
    if (list.length === 0) return 'Adicione pelo menos um contato';
    
    // Validar cada contato
    for (let i = 0; i < list.length; i++) {
      const contact = list[i];
      if (!contact.channel) return `Contato ${i + 1}: canal obrigatório`;
      if (!contact.value || contact.value.trim().length === 0) {
        return `Contato ${i + 1}: valor obrigatório`;
      }
    }
    
    return null;
  },

  slotsTotal: (v: string): string | null => {
    const num = parseInt(v, 10);
    if (isNaN(num)) return 'Número de vagas inválido';
    if (num < 1) return 'Mínimo 1 vaga';
    if (num > 20) return 'Máximo 20 vagas';
    return null;
  },
};

/**
 * Validação por step - retorna array de erros
 */
export function validateStep(step: number, data: FormState): string[] {
  const errors: string[] = [];

  if (step === 1) {
    // Step 1: Básico
    const titleError = validators.title(data.form.title);
    if (titleError) errors.push(titleError);

    const descError = validators.description(data.form.description);
    if (descError) errors.push(descError);

    const slotsError = validators.slotsTotal(data.form.slots_total);
    if (slotsError) errors.push(slotsError);
  }

  if (step === 2) {
    // Step 2: Sistema
    const systemError = validators.systemId(data.selectedSystemId);
    if (systemError) errors.push(systemError);
  }

  if (step === 3) {
    // Step 3: Sessões
    const sessionsError = validators.sessions(data.sessions);
    if (sessionsError) errors.push(sessionsError);
  }

  if (step === 4) {
    // Step 4: Configuração
    // Validação condicional: se announcer, nome do GM é obrigatório
    if (data.publisherRole === 'announcer' && !data.actualGmName) {
      errors.push('Nome do mestre obrigatório quando você é apenas anunciante');
    }

    if (data.vttPlatformId === 'custom' && !data.gamePlatformCustom.trim()) {
      errors.push('Informe a plataforma de jogo personalizada');
    }

    if (data.communicationPlatformId === 'custom' && !data.communicationPlatformCustom.trim()) {
      errors.push('Informe a plataforma de comunicação personalizada');
    }
  }

  if (step === 5) {
    // Step 5: Finalização (contatos)
    const contactsError = validators.contacts(data.contacts);
    if (contactsError) errors.push(contactsError);
  }

  if (step === 6) {
    // Step 6: Revisão (validação completa)
    errors.push(...validateStep(1, data));
    errors.push(...validateStep(2, data));
    errors.push(...validateStep(3, data));
    errors.push(...validateStep(4, data));
    errors.push(...validateStep(5, data));
  }

  return errors;
}

/**
 * Validação completa do formulário
 * Retorna array de todos os erros encontrados
 */
export function validateAll(data: FormState): string[] {
  return validateStep(6, data);
}

/**
 * Verifica se um step específico pode prosseguir
 */
export function canProceedFromStep(step: number, data: FormState): boolean {
  return validateStep(step, data).length === 0;
}

/**
 * Retorna a primeira mensagem de erro de um step (para UI simples)
 */
export function getStepError(step: number, data: FormState): string | null {
  const errors = validateStep(step, data);
  return errors.length > 0 ? errors[0] : null;
}
