import type { FormState } from '../types/createTable.types';
import type { SessionSchedule } from '../../../components/SessionRepeater';
import type { ContactFormEntry } from '../../../components/ContactsFormBlock';
import { validateContactValue } from '../../../utils/safeExternalUrl';

/**
 * Espelha `userMarkdownSchema(5000)` de
 * backend/src/validators/tableValidators.ts. Exportado porque o editor da
 * descrição (StepBasic) precisa do mesmo número para contar quanto falta.
 */
export const DESCRIPTION_MAX_LENGTH = 5000;

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
    // 5.000 é o limite REAL do contrato: `description: userMarkdownSchema(5000)`
    // em backend/src/validators/tableValidators.ts, sobre coluna TEXT sem limite.
    // O front rejeitava em 2.000 — mais restritivo que o servidor, sem nada no
    // schema que justificasse. Um anúncio colado de 3.779 caracteres passava no
    // backend e era barrado aqui, no "Continuar" (achado do mantenedor,
    // 2026-08-18). Ao mexer aqui, mexer LÁ junto: os dois números são o mesmo
    // contrato visto de dois lados.
    if (v.length > DESCRIPTION_MAX_LENGTH) {
      return `Descrição muito longa (máximo ${DESCRIPTION_MAX_LENGTH} caracteres)`;
    }
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
      // Horário de término é opcional (achado do mantenedor 2026-07-14, DEB-077-02):
      // mesas reais frequentemente não têm hora fixa de encerramento ("sessão até
      // acabar"), e o rótulo do campo na UI já não marca como obrigatório (*).
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

      // Regra por canal em validateContactValue (utils/safeExternalUrl), fonte
      // única com o editor de perfil e espelho do backend
      // (canonicalizeContactValue): canal de URL exige link alcançável, senão
      // um nick como `uwill` viraria `https://uwill/` na página pública — erro
      // de DNS para o jogador; Facebook/Instagram exigem host da própria rede,
      // senão a API aceita e a página pública não renderiza (o componente só
      // monta link de host conhecido) e o contato some sem erro em lugar nenhum.
      const valueError = validateContactValue(contact.channel, contact.value);
      if (valueError) return `Contato ${i + 1}: ${valueError}`;
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

    // Vagas é validado AQUI porque é aqui que o campo existe (StepSessions).
    // Estava no step 1, que só mostra título e descrição: apagar as vagas
    // fazia o step "Básico" exibir "Mínimo 1 vaga" e travar o Continuar por
    // causa de um campo invisível dali, duas telas adiante — sem nada na tela
    // que o mestre pudesse corrigir (achado do mantenedor, 2026-08-18).
    //
    // Regra geral desta função: um step só valida campo que ele renderiza.
    // Validar campo de outro step produz erro sem alvo, que é indistinguível
    // de formulário quebrado.
    const slotsError = validators.slotsTotal(data.form.slots_total);
    if (slotsError) errors.push(slotsError);
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
