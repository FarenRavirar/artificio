import { useState, useEffect } from 'react';
import type { FormState, DdalFormState } from '../types/createTable.types';
import type { SessionSchedule } from '../../../components/SessionRepeater';
import type { ContactFormEntry } from '../../../components/ContactsFormBlock';
import { formStateToPayload } from '../utils/mapper';
import { validateAll } from '../utils/validation';
import { authPost, authPut } from '../../../utils/authenticatedFetch';

interface UseCreateTableFormOptions {
  initialData?: Partial<FormState> & { id?: string };
  onSuccess: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Hook centralizado para gerenciar todo o estado do formulário
 */
export function useCreateTableForm(options: UseCreateTableFormOptions) {
  const { initialData, onSuccess } = options;

  // Estado do formulário básico
  const [form, setForm] = useState({
    title: initialData?.form?.title || '',
    description: initialData?.form?.description || '',
    type: initialData?.form?.type || 'campanha',
    modality: initialData?.form?.modality || 'online',
    audience: initialData?.form?.audience || 'livre',
    age_rating: initialData?.form?.age_rating || 'livre',
    price_type: initialData?.form?.price_type || 'free',
    price_value: initialData?.form?.price_value || '',
    slots_total: initialData?.form?.slots_total || '4',
    slots_open: initialData?.form?.slots_open || '4', // REQ-02: Vagas abertas
    experience_level: initialData?.form?.experience_level || 'todos',
    table_level: initialData?.form?.table_level || '',
    language: initialData?.form?.language || 'pt-BR',
  });

  // Sistema e cenário
  const [selectedSystemId, setSelectedSystemId] = useState(initialData?.selectedSystemId || '');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    initialData?.selectedScenarioId || null
  );

  // Sessões
  const [sessions, setSessions] = useState<SessionSchedule[]>(
    initialData?.sessions || [{
      day_of_week: 'segunda',
      start_time: '19:00',
      end_time: '22:00',
      frequency: 'semanal',
      is_ongoing: false,
      notes: '',
      sort_order: 0,
    }]
  );
  const [vttPlatformId, setVttPlatformId] = useState(initialData?.vttPlatformId || '');
  const [gamePlatformCustom, setGamePlatformCustom] = useState(initialData?.gamePlatformCustom || '');
  const [communicationPlatformId, setCommunicationPlatformId] = useState(initialData?.communicationPlatformId || '');
  const [communicationPlatformCustom, setCommunicationPlatformCustom] = useState(initialData?.communicationPlatformCustom || '');

  // Configuração
  const [publisherRole, setPublisherRole] = useState<'gm' | 'announcer'>(
    initialData?.publisherRole || 'gm'
  );
  const [actualGmName, setActualGmName] = useState(initialData?.actualGmName || '');
  // Requisito 8 (spec 079): id do discord_parse_case do preview — reenviado
  // no submit pra fechar o loop de aprendizado. Não editável pelo usuário na
  // UI, mas precisa de setter (achado de review, Codex PR #172): draft
  // autosalvo restaurado via handleRestoreDraft não carrega parseCaseId (não
  // é campo persistido no draft local) — sem setter, o id do preview inicial
  // ficava preso e era reenviado no submit mesmo quando o conteúdo do form
  // era substituído pelo draft de outra mesa, contaminando discord_parse_cases.
  const [parseCaseId, setParseCaseId] = useState(initialData?.parseCaseId ?? null);

  // Contatos
  const [contacts, setContacts] = useState<ContactFormEntry[]>(
    initialData?.contacts || [{
      channel: 'whatsapp',
      value: '',
      label: '',
      discord_server_url: '',
    }]
  );
  const [contactsError, setContactsError] = useState<string | null>(null);

  // Finalização
  const [rulesNotes, setRulesNotes] = useState(initialData?.rulesNotes || '');
  const [bannerUrl, setBannerUrl] = useState(initialData?.bannerUrl || '');
  const [bannerCropData, setBannerCropData] = useState<{ x: number; y: number; width: number; height: number } | null>(
    initialData?.bannerCropData || null
  );
  const [gmAvatarUrl, setGmAvatarUrl] = useState(initialData?.gmAvatarUrl || '');
  const [isCovilMesa, setIsCovilMesa] = useState(initialData?.isCovilMesa || false);
  const [bannerError, setBannerError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // DDAL
  const [ddal, setDdal] = useState<DdalFormState>({
    is_ddal: false,
    ddal_code: '',
    ddal_name: '',
    ddal_tier: '',
    ddal_season: '',
    ddal_duration: '',
    ddal_format: '',
    ddal_org_code: '',
    ddal_setting: '',
    ddal_rules_notes: '',
  });

  // Campos avançados
  const [masterDisplayName, setMasterDisplayName] = useState(initialData?.masterDisplayName || '');
  const [campaignLength, setCampaignLength] = useState(initialData?.campaignLength || '');
  const [levelRange, setLevelRange] = useState(initialData?.levelRange || '');
  const [billingText, setBillingText] = useState(initialData?.billingText || '');
  const [sessionZeroFree, setSessionZeroFree] = useState(initialData?.sessionZeroFree || false);
  const [synopsis, setSynopsis] = useState(initialData?.synopsis || '');
  const [styleText, setStyleText] = useState(initialData?.styleText || '');
  const [listingExcerpt, setListingExcerpt] = useState(initialData?.listingExcerpt || '');
  const [technicalRequirements, setTechnicalRequirements] = useState(
    initialData?.technicalRequirements || ''
  );
  const [requiresPc, setRequiresPc] = useState(initialData?.requiresPc || false);
  const [requiresCamera, setRequiresCamera] = useState(initialData?.requiresCamera || false);
  const [requiresMicrophone, setRequiresMicrophone] = useState(
    initialData?.requiresMicrophone || false
  );

  // Cenário e estilos
  const [settingName, setSettingName] = useState(initialData?.settingName || '');
  const [settingStyles, setSettingStyles] = useState<string[]>(initialData?.settingStyles || []);

  // Campos editoriais Fase 6 (REQ-28)
  const [synopsisNarrative, setSynopsisNarrative] = useState(initialData?.synopsisNarrative || '');
  const [benefitsText, setBenefitsText] = useState(initialData?.benefitsText || '');
  const [tableGmBio, setTableGmBio] = useState(initialData?.tableGmBio || '');

  // Submit State Machine
  type SubmitState = 'idle' | 'validating' | 'submitting' | 'success' | 'error';
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Dirty State Tracking
  const [isDirty, setIsDirty] = useState(false);

  // Aviso ao sair da página com mudanças não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Construir estado completo
  const formState: FormState = {
    form,
    selectedSystemId,
    selectedScenarioId,
    sessions,
    vttPlatformId,
    gamePlatformCustom,
    communicationPlatformId,
    communicationPlatformCustom,
    publisherRole,
    actualGmName,
    contacts,
    rulesNotes,
    bannerUrl,
    bannerCropData,
    gmAvatarUrl,
    isCovilMesa,
    ddal,
    masterDisplayName,
    campaignLength,
    levelRange,
    billingText,
    sessionZeroFree,
    synopsis,
    styleText,
    listingExcerpt,
    technicalRequirements,
    requiresPc,
    requiresCamera,
    requiresMicrophone,
    settingName,
    settingStyles,
    synopsisNarrative,
    benefitsText,
    tableGmBio,
    parseCaseId,
  };

  // Função de submissão com state machine
  const submit = async () => {
    setSubmitState('submitting');
    setError(null);
    setContactsError(null);

    // CORREÇÃO DT-10: Validar slots_open <= slots_total antes de enviar
    const parsedSlotsTotal = Number(form.slots_total);
    const parsedSlotsOpen = Number(form.slots_open);
    
    if (isNaN(parsedSlotsTotal) || parsedSlotsTotal < 1) {
      setError('Vagas totais deve ser um número válido maior que zero.');
      setSubmitState('idle');
      return;
    }
    
    if (isNaN(parsedSlotsOpen) || parsedSlotsOpen < 0) {
      setError('Vagas abertas deve ser um número válido maior ou igual a zero.');
      setSubmitState('idle');
      return;
    }
    
    if (parsedSlotsOpen > parsedSlotsTotal) {
      setError('Vagas abertas não pode ser maior que vagas totais.');
      setSubmitState('idle');
      return;
    }

    try {
      const payload = formStateToPayload(formState);

      const tableId = typeof initialData?.id === 'string' ? initialData.id : null;
      const isEditing = tableId !== null;
      const endpoint = isEditing 
        ? `/api/v1/gm/tables/${tableId}` 
        : `/api/v1/gm/tables`;

      const res = isEditing
        ? await authPut(endpoint, payload)
        : await authPost(endpoint, payload);

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || json.message || (isEditing ? 'Erro ao editar mesa' : 'Erro ao criar mesa'));
      }

      setSubmitState('success');
      setIsDirty(false); // Limpar dirty após sucesso
      onSuccess();
    } catch (err: unknown) {
      setSubmitState('error');
      setError(getErrorMessage(err, 'Erro inesperado'));
    }
  };

  // Computed: loading (compatibilidade com componentes existentes)
  const loading = submitState === 'submitting' || submitState === 'validating';

  // Form Controller - Camada de orquestração
  const controller = {
    /**
     * Atualiza múltiplos campos do form de uma vez
     */
    updateForm: (updates: Partial<typeof form>) => {
      setIsDirty(true);
      setForm(prev => ({ ...prev, ...updates }));
    },

    /**
     * Reset completo do formulário
     */
    reset: () => {
      setForm({
        title: '',
        description: '',
        type: 'campanha',
        modality: 'online',
        audience: 'livre',
        age_rating: 'livre',
        price_type: 'free',
        price_value: '',
        slots_total: '4',
        slots_open: '4', // REQ-02: Vagas abertas
        experience_level: 'todos',
        table_level: '',
        language: 'pt-BR',
      });
      setSelectedSystemId('');
      setSelectedScenarioId(null);
      setSessions([{
        day_of_week: 'segunda',
        start_time: '19:00',
        end_time: '22:00',
        frequency: 'semanal',
        is_ongoing: false,
        notes: '',
        sort_order: 0,
      }]);
      setContacts([{
        channel: 'whatsapp',
        value: '',
        label: '',
        discord_server_url: '',
      }]);
      setError(null);
      setContactsError(null);
      setIsDirty(false);
    },

    /**
     * Submit com validação prévia
     * Retorna true se submeteu, false se validação falhou
     */
    submitIfValid: async (): Promise<boolean> => {
      setSubmitState('validating');
      
      // Validação completa usando validators
      const errors = validateAll(formState);
      
      if (errors.length > 0) {
        setSubmitState('error');
        setError(errors.join('; '));
        return false;
      }

      await submit();
      return submitState === 'success';
    },
  };

  return {
    // Estado do formulário
    form,
    setForm,
    
    // Sistema e cenário
    selectedSystemId,
    setSelectedSystemId,
    selectedScenarioId,
    setSelectedScenarioId,
    
    // Sessões
    sessions,
    setSessions,
    vttPlatformId,
    setVttPlatformId,
    gamePlatformCustom,
    setGamePlatformCustom,
    communicationPlatformId,
    setCommunicationPlatformId,
    communicationPlatformCustom,
    setCommunicationPlatformCustom,
    
    // Configuração
    publisherRole,
    setPublisherRole,
    actualGmName,
    setActualGmName,
    parseCaseId,
    setParseCaseId,

    // Contatos
    contacts,
    setContacts,
    contactsError,
    setContactsError,
    
    // Finalização
    rulesNotes,
    setRulesNotes,
    bannerUrl,
    setBannerUrl,
    bannerCropData,
    setBannerCropData,
    gmAvatarUrl,
    setGmAvatarUrl,
    bannerError,
    setBannerError,
    avatarError,
    setAvatarError,
    isCovilMesa,
    setIsCovilMesa,
    ddal,
    setDdal,
    
    // Campos avançados
    masterDisplayName,
    setMasterDisplayName,
    campaignLength,
    setCampaignLength,
    levelRange,
    setLevelRange,
    billingText,
    setBillingText,
    sessionZeroFree,
    setSessionZeroFree,
    synopsis,
    setSynopsis,
    styleText,
    setStyleText,
    listingExcerpt,
    setListingExcerpt,
    technicalRequirements,
    setTechnicalRequirements,
    requiresPc,
    setRequiresPc,
    requiresCamera,
    setRequiresCamera,
    requiresMicrophone,
    setRequiresMicrophone,
    
    // Cenário e estilos
    settingName,
    setSettingName,
    settingStyles,
    setSettingStyles,
    
    // Campos editoriais Fase 6 (REQ-28)
    synopsisNarrative,
    setSynopsisNarrative, // CORREÇÃO DT-010: Adicionar setter
    benefitsText,
    setBenefitsText, // CORREÇÃO DT-010: Adicionar setter
    tableGmBio,
    setTableGmBio, // CORREÇÃO DT-010: Adicionar setter
    
    // Estado completo (para hooks)
    formState,
    
    // Submissão
    submit,
    loading,
    submitState,
    error,
    setError,

    // Dirty state
    isDirty,

    // Controller (orquestração de alto nível)
    controller,
  };
}

