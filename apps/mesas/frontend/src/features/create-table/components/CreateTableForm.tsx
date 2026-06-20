import { useCallback, useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import type { SystemTreeNode } from '../../../types/systems';
import type { FormState } from '../types/createTable.types';

// Hooks customizados
import { useCreateTableForm } from '../hooks/useCreateTableForm';
import { useStepNavigation } from '../hooks/useStepNavigation';
import { useAutosave } from '../hooks/useAutosave';
import { useAuth } from '../../../contexts/useAuth';

// Componentes
import { StepHeader } from '../../../components/form-steps/StepHeader';
import { StepActions } from '../../../components/form-steps/StepActions';
import { StepBasic } from '../../../components/form-steps/steps/StepBasic';
import { StepSystem } from '../../../components/form-steps/steps/StepSystem';
import { StepSessions } from '../../../components/form-steps/steps/StepSessions';
import { StepConfig } from '../../../components/form-steps/steps/StepConfig';
import { StepFinal } from '../../../components/form-steps/steps/StepFinal';
import { StepReview } from '../../../components/form-steps/steps/StepReview';

// Utils
import { draftStorage } from '../utils/draftStorage';

const DDAL_ELIGIBLE_PATH = 'dungeons-dragons/5e/2024';

interface CreateTableFormProps {
  onSuccess: () => void;
  initialData?: Partial<FormState> & { id?: string };
}

type FlattenedSystemNode = Pick<SystemTreeNode, 'id' | 'slug' | 'name' | 'path_slug'> & {
  pathLabel: string;
};

type CreateTableDraft = ReturnType<typeof useCreateTableForm>['formState'];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isSystemTreeNode(value: unknown): value is SystemTreeNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Partial<SystemTreeNode>;
  const hasValidChildren = node.children === undefined || (Array.isArray(node.children) && node.children.every(isSystemTreeNode));
  return typeof node.id === 'string' && typeof node.slug === 'string' && typeof node.name === 'string' && hasValidChildren;
}

function normalizeSystemsTree(payload: unknown): SystemTreeNode[] {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return [];
  const data = (payload as { data: unknown }).data;
  return Array.isArray(data) ? data.filter(isSystemTreeNode) : [];
}

const flattenTree = (nodes: SystemTreeNode[], breadcrumb: string[] = []): FlattenedSystemNode[] => {
  const flattened: FlattenedSystemNode[] = [];
  for (const node of nodes) {
    const path = [...breadcrumb, node.name];
    flattened.push({
      id: node.id,
      slug: node.slug,
      name: node.name,
      path_slug: node.path_slug,
      pathLabel: path.join(' > '),
    });
    if (node.children) {
      flattened.push(...flattenTree(node.children, path));
    }
  }
  return flattened;
};

export function CreateTableForm({
  onSuccess,
  initialData,
}: CreateTableFormProps) {
  // Hooks customizados
  const formHook = useCreateTableForm({
    initialData,
    onSuccess: () => {
      draftStorage.clear('create-table-draft');
      onSuccess();
    },
  });

  const navigation = useStepNavigation(formHook.formState);

  const { draftStatus } = useAutosave(formHook.formState, {
    enabled: true, // CORREÇÃO DT-AGG-04: Sempre habilitado (modo review removido)
  });

  // Auth context para verificar role do usuário
  const { user } = useAuth();

  // Estado de sistemas (mantido aqui pois é específico da UI)
  const [systemsTree, setSystemsTree] = useState<SystemTreeNode[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState<string | null>(null);

  // Modal de restore
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [savedDraft, setSavedDraft] = useState<CreateTableDraft | null>(null);

  // Fetch systems tree
  const fetchSystemsTree = useCallback(async () => {
    setSystemsLoading(true);
    setSystemsError(null);

    try {
      const res = await fetch('/api/v1/systems?view=tree');
      if (!res.ok) throw new Error('Erro ao carregar árvore de sistemas.');
      const json: unknown = await res.json();
      setSystemsTree(normalizeSystemsTree(json));
    } catch (err: unknown) {
      setSystemsError(getErrorMessage(err, 'Erro ao carregar árvore de sistemas.'));
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => { await fetchSystemsTree(); })();
  }, [fetchSystemsTree]);

  // Restore de draft. setState deferido p/ fora do corpo síncrono do effect.
  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      // CORREÇÃO DT-AGG-04: Modo review removido, sempre restaurar draft
      const draft = draftStorage.load<CreateTableDraft>('create-table-draft');
      if (!draft) return;
      setSavedDraft(draft);
      setShowRestoreModal(true);
    })();
    return () => { active = false; };
  }, []);

  const handleRestoreDraft = () => {
    if (!savedDraft) return;

    // Restaurar estados
    if (savedDraft.form) formHook.setForm(savedDraft.form);
    if (savedDraft.sessions) formHook.setSessions(savedDraft.sessions);
    if (savedDraft.contacts) formHook.setContacts(savedDraft.contacts);
    if (savedDraft.selectedSystemId) formHook.setSelectedSystemId(savedDraft.selectedSystemId);
    if (savedDraft.selectedScenarioId) formHook.setSelectedScenarioId(savedDraft.selectedScenarioId);
    if (savedDraft.publisherRole) formHook.setPublisherRole(savedDraft.publisherRole);
    if (savedDraft.actualGmName) formHook.setActualGmName(savedDraft.actualGmName);
    if (savedDraft.rulesNotes) formHook.setRulesNotes(savedDraft.rulesNotes);
    if (savedDraft.bannerUrl) formHook.setBannerUrl(savedDraft.bannerUrl);
    if (savedDraft.isCovilMesa !== undefined) formHook.setIsCovilMesa(savedDraft.isCovilMesa);
    if (savedDraft.ddal) formHook.setDdal(savedDraft.ddal);
    if (savedDraft.masterDisplayName) formHook.setMasterDisplayName(savedDraft.masterDisplayName);
    if (savedDraft.campaignLength) formHook.setCampaignLength(savedDraft.campaignLength);
    if (savedDraft.levelRange) formHook.setLevelRange(savedDraft.levelRange);
    if (savedDraft.billingText) formHook.setBillingText(savedDraft.billingText);
    if (savedDraft.sessionZeroFree !== undefined) formHook.setSessionZeroFree(savedDraft.sessionZeroFree);
    if (savedDraft.synopsis) formHook.setSynopsis(savedDraft.synopsis);
    if (savedDraft.styleText) formHook.setStyleText(savedDraft.styleText);
    if (savedDraft.listingExcerpt) formHook.setListingExcerpt(savedDraft.listingExcerpt);
    if (savedDraft.technicalRequirements) formHook.setTechnicalRequirements(savedDraft.technicalRequirements);
    if (savedDraft.requiresPc !== undefined) formHook.setRequiresPc(savedDraft.requiresPc);
    if (savedDraft.requiresCamera !== undefined) formHook.setRequiresCamera(savedDraft.requiresCamera);
    if (savedDraft.requiresMicrophone !== undefined) formHook.setRequiresMicrophone(savedDraft.requiresMicrophone);
    if (savedDraft.settingName) formHook.setSettingName(savedDraft.settingName);
    if (savedDraft.settingStyles) formHook.setSettingStyles(savedDraft.settingStyles);

    setShowRestoreModal(false);
    toast.success('Rascunho restaurado');
  };

  const handleDiscardDraft = () => {
    draftStorage.clear('create-table-draft');
    setSavedDraft(null);
    setShowRestoreModal(false);
  };

  // Dados derivados
  const flattenedSystems = flattenTree(systemsTree);
  const selectedSystem = flattenedSystems.find((s) => s.id === formHook.selectedSystemId) ?? null;
  const isDdalEligibleSelection =
    selectedSystem?.path_slug === DDAL_ELIGIBLE_PATH ||
    selectedSystem?.path_slug?.startsWith(`${DDAL_ELIGIBLE_PATH}/`) === true;

  // Nome do sistema e cenário para review
  const selectedSystemName = selectedSystem?.name || null;
  const [selectedScenarioName, setSelectedScenarioName] = useState<string | null>(null);
  const { setDdal } = formHook;

  useEffect(() => {
    let active = true;
    // setState só após await (sem set síncrono no corpo do effect).
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      if (!formHook.selectedScenarioId) {
        setSelectedScenarioName(null);
        return;
      }
      try {
        const res = await fetch(`/api/v1/scenarios/${formHook.selectedScenarioId}`);
        if (res.ok && active) {
          const data = await res.json();
          if (active) setSelectedScenarioName(data.data?.name || null);
        } else if (active) {
          setSelectedScenarioName(null);
        }
      } catch (err) {
        console.error('[CreateTableForm] Erro ao buscar nome do cenário:', err);
        if (active) setSelectedScenarioName(null);
      }
    })();
    return () => { active = false; };
  }, [formHook.selectedScenarioId]);

  // Desabilitar DDAL se sistema não for elegível
  useEffect(() => {
    if (!isDdalEligibleSelection && formHook.ddal.is_ddal) {
      setDdal((prev) => ({ ...prev, is_ddal: false }));
    }
  }, [isDdalEligibleSelection, formHook.ddal.is_ddal, setDdal]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await formHook.submit();
  };

  return (
    <>
      {/* Modal de restore */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B1628] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-xl font-bold text-white">Rascunho encontrado</h3>
            <p className="text-white/70 text-sm">
              Encontramos um rascunho salvo. Deseja continuar de onde parou?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRestoreDraft}
                autoFocus
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] text-white font-semibold transition-colors"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="flex-1 px-4 py-3 rounded-xl border border-white/20 hover:border-white/40 text-white/70 hover:text-white transition-colors"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Feedback de autosave */}
        {draftStatus !== 'idle' && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            {draftStatus === 'saving' && (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
                <span>Salvando rascunho...</span>
              </>
            )}
            {draftStatus === 'saved' && (
              <>
                <span className="text-green-400">✔</span>
                <span className="text-green-400/70">Rascunho salvo</span>
              </>
            )}
          </div>
        )}

        <StepHeader
          step={navigation.step}
          maxStepUnlocked={navigation.maxStepUnlocked}
          onNavigate={navigation.goTo}
        />

        {navigation.step === 1 && <StepBasic form={formHook.form} setForm={formHook.setForm} />}

        {navigation.step === 2 && (
          <StepSystem
            systemsTree={systemsTree}
            systemsLoading={systemsLoading}
            systemsError={systemsError}
            selectedSystemId={formHook.selectedSystemId}
            setSelectedSystemId={formHook.setSelectedSystemId}
            selectedScenarioId={formHook.selectedScenarioId}
            setSelectedScenarioId={formHook.setSelectedScenarioId}
            onRefreshSystems={fetchSystemsTree}
          />
        )}

        {navigation.step === 3 && (
          <StepSessions 
            sessions={formHook.sessions} 
            setSessions={formHook.setSessions}
            form={formHook.form}
            setForm={formHook.setForm}
          />
        )}

        {navigation.step === 4 && (
          <StepConfig
            form={formHook.form}
            setForm={formHook.setForm}
            publisherRole={formHook.publisherRole}
            setPublisherRole={formHook.setPublisherRole}
            actualGmName={formHook.actualGmName}
            setActualGmName={formHook.setActualGmName}
            vttPlatformId={formHook.vttPlatformId}
            setVttPlatformId={formHook.setVttPlatformId}
            gamePlatformCustom={formHook.gamePlatformCustom}
            setGamePlatformCustom={formHook.setGamePlatformCustom}
            communicationPlatformId={formHook.communicationPlatformId}
            setCommunicationPlatformId={formHook.setCommunicationPlatformId}
            communicationPlatformCustom={formHook.communicationPlatformCustom}
            setCommunicationPlatformCustom={formHook.setCommunicationPlatformCustom}
          />
        )}

        {navigation.step === 5 && (
          <StepFinal
            contacts={formHook.contacts}
            setContacts={formHook.setContacts}
            contactsError={formHook.contactsError}
            setContactsError={formHook.setContactsError}
            rulesNotes={formHook.rulesNotes}
            setRulesNotes={formHook.setRulesNotes}
            bannerUrl={formHook.bannerUrl}
            setBannerUrl={formHook.setBannerUrl}
            bannerCropData={formHook.bannerCropData}
            setBannerCropData={formHook.setBannerCropData}
            bannerError={formHook.bannerError}
            setBannerError={formHook.setBannerError}
            gmAvatarUrl={formHook.gmAvatarUrl}
            setGmAvatarUrl={formHook.setGmAvatarUrl}
            avatarError={formHook.avatarError}
            setAvatarError={formHook.setAvatarError}
            isCovilMesa={formHook.isCovilMesa}
            setIsCovilMesa={formHook.setIsCovilMesa}
            isDdalEligibleSelection={isDdalEligibleSelection}
            ddal={formHook.ddal}
            setDdal={formHook.setDdal}
            masterDisplayName={formHook.masterDisplayName}
            setMasterDisplayName={formHook.setMasterDisplayName}
            campaignLength={formHook.campaignLength}
            setCampaignLength={formHook.setCampaignLength}
            levelRange={formHook.levelRange}
            setLevelRange={formHook.setLevelRange}
            billingText={formHook.billingText}
            setBillingText={formHook.setBillingText}
            sessionZeroFree={formHook.sessionZeroFree}
            setSessionZeroFree={formHook.setSessionZeroFree}
            synopsis={formHook.synopsis}
            setSynopsis={formHook.setSynopsis}
            styleText={formHook.styleText}
            setStyleText={formHook.setStyleText}
            listingExcerpt={formHook.listingExcerpt}
            setListingExcerpt={formHook.setListingExcerpt}
            technicalRequirements={formHook.technicalRequirements}
            setTechnicalRequirements={formHook.setTechnicalRequirements}
            requiresPc={formHook.requiresPc}
            setRequiresPc={formHook.setRequiresPc}
            requiresCamera={formHook.requiresCamera}
            setRequiresCamera={formHook.setRequiresCamera}
            requiresMicrophone={formHook.requiresMicrophone}
            setRequiresMicrophone={formHook.setRequiresMicrophone}
            settingName={formHook.settingName}
            setSettingName={formHook.setSettingName}
            settingStyles={formHook.settingStyles}
            setSettingStyles={formHook.setSettingStyles}
            selectedScenarioName={selectedScenarioName}
            priceType={formHook.form.price_type}
            userRole={user?.role}
          />
        )}

        {navigation.step === 6 && (
          <StepReview
            form={formHook.form}
            selectedSystemName={selectedSystemName}
            selectedScenarioName={selectedScenarioName}
            sessions={formHook.sessions}
            contacts={formHook.contacts}
            publisherRole={formHook.publisherRole}
            actualGmName={formHook.actualGmName}
            rulesNotes={formHook.rulesNotes}
            bannerUrl={formHook.bannerUrl}
          />
        )}

        {formHook.error && (
          <div className="p-4 bg-red-900/40 border border-red-700/50 rounded-xl text-red-300 text-sm">
            {formHook.error}
          </div>
        )}

        <StepActions
          step={navigation.step}
          setStep={(n) => {
            if (n < navigation.step) {
              navigation.goTo(n);
            } else {
              navigation.next();
            }
          }}
          canNext={navigation.canProceed}
          errorMessage={navigation.getStepError}
          onSubmit={formHook.submit}
          loading={formHook.loading}
        />
      </form>
    </>
  );
}
