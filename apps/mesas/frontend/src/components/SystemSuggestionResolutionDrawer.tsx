import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from "@artificio/ui";
import { TagInput } from './TagInput';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';
import { authGet, authPost } from '../services/apiClient';

const NODE_TYPE_LABELS: Record<string, string> = {
  system: 'Sistema',
  edition: 'Edição',
  variant: 'Variante',
  subsystem: 'Subsistema',
};

const EMPTY_SYSTEMS: SystemOption[] = [];

const toSearchOption = (s: SystemOption): SearchableOption => ({
  id: s.id,
  label: s.name,
  sublabel: s.path_slug || s.id,
  caption: s.name_pt ? `Nome PT: ${s.name_pt}` : undefined,
  badge: NODE_TYPE_LABELS[s.node_type] ?? s.node_type,
  chips: s.aliases,
  keywords: [s.name, s.name_pt ?? '', s.path_slug, ...s.aliases],
});

// --- Tipos locais (resposta da API tratada como unknown ate normalizar) ---

export interface ResolvableSuggestion {
  id: string;
  name: string;
  description: string | null;
  node_type: 'system' | 'edition' | 'variant' | 'subsystem';
  parent_id: string | null;
}

interface SystemOption {
  id: string;
  name: string;
  name_pt: string | null;
  parent_id: string | null;
  path_slug: string;
  node_type: string;
  depth: number;
  children_count: number;
  aliases: string[];
}

type CandidateReason = string;

interface Candidate {
  system_id: string;
  name: string;
  path_slug: string | null;
  node_type: string;
  score: number;
  reasons: CandidateReason[];
}

interface CandidateAnalysis {
  base: string;
  edition_tokens: string[];
  suggested_child_name: string | null;
  suggested_child_type: 'edition' | 'variant' | 'subsystem';
  has_edition_context: boolean;
  has_qualifier_context: boolean;
}

type ResolutionType = 'create_alias' | 'create_child' | 'create_chain' | 'create_system' | 'merge_existing' | 'reject';

interface ResolveResultData {
  system_name?: string;
  pending_drafts?: Array<{ id: string; title: string | null }>;
}

// --- Normalizadores defensivos ---

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const readNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const readNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const normalizeLoose = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeSystemOptions = (value: unknown): SystemOption[] => {
  if (!Array.isArray(value)) return [];
  const out: SystemOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = readString(row.id);
    const name = readString(row.name);
    if (!id || !name) continue;
    out.push({
      id,
      name,
      name_pt: readNullableString(row.name_pt),
      parent_id: readNullableString(row.parent_id),
      path_slug: readString(row.path_slug),
      node_type: readString(row.node_type) || 'system',
      depth: readNumber(row.depth),
      children_count: readNumber(row.children_count),
      aliases: Array.isArray(row.aliases) ? row.aliases.filter((a): a is string => typeof a === 'string') : [],
    });
  }
  return out.sort((a, b) => a.path_slug.localeCompare(b.path_slug) || a.name.localeCompare(b.name));
};

const normalizeCandidates = (value: unknown): Candidate[] => {
  if (!Array.isArray(value)) return [];
  const out: Candidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const systemId = readString(row.system_id);
    if (!systemId) continue;
    const reasons = Array.isArray(row.reasons)
      ? row.reasons.filter((r): r is string => typeof r === 'string')
      : [];
    out.push({
      system_id: systemId,
      name: readString(row.name),
      path_slug: readNullableString(row.path_slug),
      node_type: readString(row.node_type) || 'system',
      score: readNumber(row.score),
      reasons,
    });
  }
  return out;
};

const normalizeCandidateAnalysis = (value: unknown): CandidateAnalysis => {
  const fallback: CandidateAnalysis = {
    base: '',
    edition_tokens: [],
    suggested_child_name: null,
    suggested_child_type: 'edition',
    has_edition_context: false,
    has_qualifier_context: false,
  };
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Record<string, unknown>;
  const suggestedChildType = readString(row.suggested_child_type);
  return {
    base: readString(row.base),
    edition_tokens: Array.isArray(row.edition_tokens)
      ? row.edition_tokens.filter((token): token is string => typeof token === 'string')
      : [],
    suggested_child_name: readNullableString(row.suggested_child_name),
    suggested_child_type:
      suggestedChildType === 'variant' || suggestedChildType === 'subsystem' || suggestedChildType === 'edition'
        ? suggestedChildType
        : 'edition',
    has_edition_context: row.has_edition_context === true,
    has_qualifier_context: row.has_qualifier_context === true,
  };
};

const REASON_LABELS: Record<string, string> = {
  name_exact: 'nome igual',
  name_pt_exact: 'nome PT igual',
  alias_exact: 'alias igual',
  base_match: 'mesmo nome base',
  base_plus_edition: 'nome base + edição',
  base_plus_qualifier: 'nome base + complemento',
  existing_child_match: 'edição já cadastrada',
  fuzzy_similar: 'parecido',
};

const RESOLUTION_OPTIONS: Array<{ value: ResolutionType; label: string }> = [
  { value: 'create_alias', label: 'Alias / nome alternativo' },
  { value: 'create_child', label: 'Edição / variante / subsistema' },
  { value: 'create_chain', label: 'Criar cadeia completa' },
  { value: 'merge_existing', label: 'Mesclar (já existe)' },
  { value: 'create_system', label: 'Sistema novo (raiz)' },
  { value: 'reject', label: 'Rejeitar' },
];

const RECOMMENDED_LABELS: Record<string, string> = {
  merge_existing: 'Mesclar com existente',
  create_alias: 'Criar alias',
  create_child: 'Criar edição/variante',
  create_chain: 'Criar cadeia completa',
  create_system: 'Criar sistema novo',
};

const slugifyPreview = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const systemLabel = (system: Pick<SystemOption, 'name' | 'path_slug' | 'node_type' | 'name_pt'>): string => {
  const type = NODE_TYPE_LABELS[system.node_type] ?? system.node_type;
  const path = system.path_slug || system.name;
  return `${system.name} · ${type} · ${path}${system.name_pt ? ` · PT: ${system.name_pt}` : ''}`;
};

const matchesNameOrAlias = (system: SystemOption, value: string): boolean => {
  const wanted = normalizeLoose(value);
  if (!wanted) return false;
  if (normalizeLoose(system.name) === wanted) return true;
  if (system.name_pt && normalizeLoose(system.name_pt) === wanted) return true;
  for (const alias of system.aliases) {
    if (normalizeLoose(alias) === wanted) return true;
  }
  return false;
};

const stripTrailingTokenText = (value: string, tokens: string[]): string => {
  let out = value.trim();
  for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?:\\s|-)+${escaped}\\.?$`, 'i'), '').trim();
  }
  return out.replace(/[.:;,-]+$/g, '').trim();
};

interface ContextChipsProps {
  label: string;
  values: string[];
  tone?: 'blue' | 'amber' | 'white';
  limit?: number;
}

const ContextChips = ({ label, values, tone = 'blue', limit = 6 }: ContextChipsProps) => {
  if (values.length === 0) return null;
  const visible = values.slice(0, limit);
  const hidden = values.length - visible.length;
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-500/15 text-amber-100'
      : tone === 'white'
        ? 'bg-white/10 text-white/70'
        : 'bg-blue-500/15 text-blue-100';

  return (
    <div className="mt-2">
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {visible.map((value) => (
          <span key={value} className={`rounded px-1.5 py-0.5 text-xs ${toneClass}`}>
            {value}
          </span>
        ))}
        {hidden > 0 && <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">+{hidden}</span>}
      </div>
    </div>
  );
};

interface SystemContextPanelProps {
  title: string;
  system: SystemOption | null;
  children: SystemOption[];
  note?: string;
  risks?: string[];
}

const SystemContextPanel = ({ title, system, children, note, risks = [] }: SystemContextPanelProps) => {
  if (!system) return null;
  const childLabels = children.map((child) => `${child.name}${child.name_pt ? ` / ${child.name_pt}` : ''} (${NODE_TYPE_LABELS[child.node_type] ?? child.node_type})`);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-white/40 text-xs uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-sm font-medium text-white">{system.name}</p>
      <p className="text-xs text-white/50">{systemLabel(system)}</p>
      <p className="mt-1 text-xs text-white/50">
        {children.length > 0
          ? `${children.length} filho(s) listado(s)`
          : system.children_count > 0
            ? `${system.children_count} filho(s) informado(s) pela API`
            : 'Sem filhos cadastrados.'}
      </p>
      {note && <p className="mt-2 text-sm text-white/70">{note}</p>}
      <ContextChips label="Aliases existentes" values={system.aliases} />
      <ContextChips label="Edições / variantes / subsistemas existentes" values={childLabels} tone="white" limit={8} />
      <ContextChips label="Risco / conflito" values={risks} tone="amber" />
    </div>
  );
};

interface RelatedActionsProps {
  items: Array<{ label: string; onClick: () => void; tone?: 'blue' | 'amber' | 'white' }>;
}

const RelatedActions = ({ items }: RelatedActionsProps) => {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-white/40 text-xs uppercase tracking-wide">Ações relacionadas</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const className =
            item.tone === 'amber'
              ? 'bg-amber-500/20 text-amber-50 hover:bg-amber-500/30'
              : item.tone === 'white'
                ? 'bg-white/10 text-white/80 hover:bg-white/20'
                : 'bg-blue-600/30 text-blue-100 hover:bg-blue-600/40';
          return (
            <button key={item.label} type="button" onClick={item.onClick} className={`rounded px-2 py-1 text-xs ${className}`}>
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface Props {
  suggestion: ResolvableSuggestion;
  onClose: () => void;
  onResolved: (data: ResolveResultData) => void;
}

export const SystemSuggestionResolutionDrawer = ({ suggestion, onClose, onResolved }: Props) => {
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [analysis, setAnalysis] = useState<CandidateAnalysis>(() => normalizeCandidateAnalysis(null));
  const [recommended, setRecommended] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [resolutionType, setResolutionType] = useState<ResolutionType>('create_alias');
  const [targetSystemId, setTargetSystemId] = useState('');
  const [parentId, setParentId] = useState('');
  const [childNodeType, setChildNodeType] = useState<'edition' | 'variant' | 'subsystem'>('edition');
  const [rootName, setRootName] = useState(suggestion.name);
  const [childName, setChildName] = useState(suggestion.name);
  const [editionName, setEditionName] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [parentAliases, setParentAliases] = useState<string[]>([]);
  const [namePt, setNamePt] = useState('');
  const [description, setDescription] = useState(suggestion.description ?? '');
  const [aliasText, setAliasText] = useState(suggestion.name);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [forceNew, setForceNew] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [candRes, sysRes] = await Promise.all([
          authGet(`/api/v1/admin/system-suggestions/${suggestion.id}/candidates`),
          authGet('/api/v1/systems'),
        ]);

        if (!cancelled && candRes.ok) {
          const json: unknown = await candRes.json();
          const data = json && typeof json === 'object' ? (json as Record<string, unknown>).data : null;
          const dataObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
          const cands = normalizeCandidates(dataObj.candidates);
          const nextAnalysis = normalizeCandidateAnalysis(dataObj.analysis);
          setCandidates(cands);
          setAnalysis(nextAnalysis);
          const rec = readString(dataObj.recommended_action);
          setRecommended(rec);
          if (nextAnalysis.suggested_child_name) {
            setChildName(nextAnalysis.suggested_child_name);
            setChildNodeType(nextAnalysis.suggested_child_type);
          }

          // Pré-seleciona a acao recomendada e o melhor candidato.
          if (rec === 'merge_existing') setResolutionType('merge_existing');
          else if (rec === 'create_alias') setResolutionType('create_alias');
          else if (rec === 'create_child') setResolutionType('create_child');
          else if (rec === 'create_system') setResolutionType('create_system');
          if (cands[0]) {
            setTargetSystemId(cands[0].system_id);
            if (cands[0].node_type === 'system') setParentId(cands[0].system_id);
          }
        }

        if (!cancelled && sysRes.ok) {
          const json: unknown = await sysRes.json();
          const data = json && typeof json === 'object' ? (json as Record<string, unknown>).data : null;
          setSystems(normalizeSystemOptions(data));
        }
      } catch (error) {
        if (!cancelled) console.error('[ResolutionDrawer] erro ao carregar candidatos/sistemas', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [suggestion.id]);

  const rootSystems = useMemo(() => systems.filter((s) => s.node_type === 'system'), [systems]);
  const editionsAndSubsystems = useMemo(
    () => systems.filter((s) => s.node_type === 'edition' || s.node_type === 'subsystem'),
    [systems],
  );
  const systemById = useMemo(() => {
    const map = new Map<string, SystemOption>();
    for (const system of systems) {
      map.set(system.id, system);
    }
    return map;
  }, [systems]);
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, SystemOption[]>();
    for (const system of systems) {
      if (!system.parent_id) continue;
      const current = map.get(system.parent_id) ?? [];
      current.push(system);
      map.set(system.parent_id, current);
    }
    for (const children of map.values()) {
      children.sort((a, b) => a.path_slug.localeCompare(b.path_slug) || a.name.localeCompare(b.name));
    }
    return map;
  }, [systems]);

  const bestCandidate = candidates[0] ?? null;
  const applySystemSelection = (systemId: string) => {
    setTargetSystemId(systemId);
    const system = systemById.get(systemId);
    if (!system) return;
    if (system.node_type === 'system') {
      setParentId(system.id);
      return;
    }
    if (system.parent_id) {
      setParentId(system.parent_id);
    }
  };

  const switchResolutionType = (next: ResolutionType) => {
    setResolutionType(next);
    if ((next === 'create_alias' || next === 'merge_existing') && bestCandidate && !targetSystemId) {
      setTargetSystemId(bestCandidate.system_id);
    }
    if (next === 'create_child') {
      if (analysis.suggested_child_name && childName === suggestion.name) {
        setChildName(analysis.suggested_child_name);
      }
      setChildNodeType(analysis.suggested_child_type);
      if (bestCandidate && !parentId) {
        applySystemSelection(bestCandidate.system_id);
      }
    }
  };

  useEffect(() => {
    if (recommended !== 'create_child' || parentId || candidates.length === 0 || systems.length === 0) return;
    const candidate = systemById.get(candidates[0].system_id);
    if (!candidate) return;
    let active = true;
    // Auto-seleção de pai deferida p/ fora do corpo síncrono do effect.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      if (candidate.node_type === 'system') {
        setParentId(candidate.id);
      } else if (candidate.parent_id) {
        setParentId(candidate.parent_id);
      }
    })();
    return () => { active = false; };
  }, [recommended, parentId, candidates, systems, systemById]);

  // Pais validos por tipo de filho (espelha VALID_PARENT do backend).
  const validParents = useMemo(() => {
    if (childNodeType === 'variant') return editionsAndSubsystems;
    return rootSystems; // edition e subsystem -> filhos de system
  }, [childNodeType, editionsAndSubsystems, rootSystems]);

  const systemOptions = useMemo(() => systems.map(toSearchOption), [systems]);
  const parentOptions = useMemo(() => validParents.map(toSearchOption), [validParents]);

  const targetSystem = systemById.get(targetSystemId) ?? null;
  const parentSystem = systemById.get(parentId) ?? null;
  const suggestedParentAlias = useMemo(() => {
    const tokens = analysis.suggested_child_name
      ? [analysis.suggested_child_name, ...analysis.edition_tokens]
      : analysis.edition_tokens;
    const alias = stripTrailingTokenText(suggestion.name, tokens);
    if (!alias || normalizeLoose(alias) === normalizeLoose(suggestion.name)) return '';
    if (parentSystem && matchesNameOrAlias(parentSystem, alias)) return '';
    return alias;
  }, [analysis, suggestion.name, parentSystem]);

  useEffect(() => {
    if (!suggestedParentAlias || parentAliases.length > 0) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (active) setParentAliases([suggestedParentAlias]);
    })();
    return () => { active = false; };
  }, [suggestedParentAlias, parentAliases.length]);

  const targetChildren = targetSystem ? childrenByParentId.get(targetSystem.id) ?? EMPTY_SYSTEMS : EMPTY_SYSTEMS;
  const parentChildren = parentSystem ? childrenByParentId.get(parentSystem.id) ?? EMPTY_SYSTEMS : EMPTY_SYSTEMS;
  const aliasMatchRisks = useMemo(() => {
    const text = aliasText.trim();
    if (!text) return EMPTY_SYSTEMS;
    const matches: SystemOption[] = [];
    for (const system of systems) {
      if (matchesNameOrAlias(system, text)) matches.push(system);
    }
    return matches;
  }, [aliasText, systems]);
  const childNameRisks = useMemo(() => {
    const text = childName.trim();
    if (!text || !parentSystem) return EMPTY_SYSTEMS;
    const wanted = normalizeLoose(text);
    const matches: SystemOption[] = [];
    for (const child of parentChildren) {
      if (normalizeLoose(child.name) === wanted || (child.name_pt && normalizeLoose(child.name_pt) === wanted)) {
        matches.push(child);
        continue;
      }
      for (const alias of child.aliases) {
        if (normalizeLoose(alias) === wanted) {
          matches.push(child);
          break;
        }
      }
    }
    return matches;
  }, [childName, parentSystem, parentChildren]);
  const createSystemRiskLabels = useMemo(() => {
    const labels: string[] = [];
    for (const candidate of candidates) {
      const system = systemById.get(candidate.system_id);
      labels.push(system ? systemLabel(system) : `${candidate.name} · ${candidate.path_slug ?? candidate.system_id}`);
    }
    return labels;
  }, [candidates, systemById]);

  const preview = useMemo(() => {
    switch (resolutionType) {
      case 'create_alias':
        return targetSystem
          ? `Alias "${aliasText.trim()}" será adicionado a ${systemLabel(targetSystem)}.`
          : 'Escolha o sistema alvo.';
      case 'merge_existing':
        return targetSystem
          ? `Nada será criado. A sugestão será marcada como coberta por ${systemLabel(targetSystem)}.`
          : 'Escolha o sistema alvo.';
      case 'create_child':
        return parentSystem
          ? `Novo ${NODE_TYPE_LABELS[childNodeType] ?? childNodeType} abaixo de ${systemLabel(parentSystem)}: ${parentSystem.path_slug || parentSystem.name}/${slugifyPreview(childName)}`
          : 'Escolha o sistema pai.';
      case 'create_chain':
        return 'Aprovar todas as sugestões pendentes do mesmo lote em uma transação, criando sistema, edição e variante na ordem.';
      case 'create_system':
        return `${editionName.trim()
          ? `Novo sistema: ${slugifyPreview(rootName)} + edição ${slugifyPreview(rootName)}/${slugifyPreview(editionName)}`
          : `Novo sistema raiz: ${slugifyPreview(rootName)}`}${createSystemRiskLabels.length > 0 ? ` Risco: candidato similar existente (${createSystemRiskLabels[0]}).` : ''}`;
      case 'reject':
        return 'Rejeitar a sugestão.';
      default:
        return '';
    }
  }, [resolutionType, targetSystem, parentSystem, aliasText, childNodeType, childName, rootName, editionName, createSystemRiskLabels]);

  const splitEdition = () => {
    const m = rootName.trim().match(/^(.*?)[\s-]+(\d+(?:\.\d+)?|\d+e|\d+[ªaA]|(?:19|20)\d{2})$/);
    if (m && m[1].trim()) {
      setRootName(m[1].trim());
      setEditionName(m[2]);
      toast.success(`Separado: ${m[1].trim()} + ${m[2]}`);
    } else {
      toast.error('Nenhuma edição detectada no nome.');
    }
  };

  const buildBody = (): Record<string, unknown> => {
    switch (resolutionType) {
      case 'create_alias':
        return { resolution_type: 'create_alias', target_system_id: targetSystemId, alias: aliasText.trim(), notes: notes.trim() || undefined };
      case 'merge_existing':
        return { resolution_type: 'merge_existing', target_system_id: targetSystemId, notes: notes.trim() || undefined };
      case 'create_child':
        return {
          resolution_type: 'create_child',
          node_type: childNodeType,
          parent_id: parentId,
          name: childName.trim(),
          name_pt: namePt.trim() || undefined,
          description: description.trim() || undefined,
          aliases: aliases.length > 0 ? aliases : undefined,
          parent_aliases: parentAliases.length > 0 ? parentAliases : undefined,
          notes: notes.trim() || undefined,
        };
      case 'create_chain':
        return {
          resolution_type: 'create_chain',
          notes: notes.trim() || undefined,
        };
      case 'create_system':
        return {
          resolution_type: 'create_system',
          name: rootName.trim(),
          name_pt: namePt.trim() || undefined,
          description: description.trim() || undefined,
          edition_name: editionName.trim() || undefined,
          aliases: aliases.length > 0 ? aliases : undefined,
          notes: notes.trim() || undefined,
          force: forceNew || undefined,
        };
      case 'reject':
        return { resolution_type: 'reject', reason: reason.trim() || undefined };
      default:
        return {};
    }
  };

  const validate = (): string | null => {
    if (resolutionType === 'create_alias') {
      if (!targetSystemId) return 'Escolha o sistema alvo.';
      if (!aliasText.trim()) return 'Informe o texto do alias.';
    }
    if (resolutionType === 'merge_existing' && !targetSystemId) return 'Escolha o sistema alvo.';
    if (resolutionType === 'create_child') {
      if (!parentId) return 'Escolha o sistema pai.';
      if (!childName.trim()) return 'Informe o nome.';
    }
    if (resolutionType === 'create_system' && !rootName.trim()) return 'Informe o nome.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await authPost(
        `/api/v1/admin/system-suggestions/${suggestion.id}/resolve`,
        buildBody(),
      );

      const json: unknown = await response.json().catch(() => ({}));
      const payload = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};

      if (response.ok) {
        const data = payload.data && typeof payload.data === 'object' ? (payload.data as ResolveResultData) : {};
        toast.success('Sugestão resolvida.');
        onResolved(data);
        return;
      }

      // NFR-001: backend bloqueia criar raiz quando ha candidato similar.
      if (response.status === 409 && readString(payload.recommended_action)) {
        setCandidates(normalizeCandidates(payload.candidates));
        const nextAnalysis = normalizeCandidateAnalysis(payload.analysis);
        setAnalysis(nextAnalysis);
        const rec = readString(payload.recommended_action);
        setRecommended(rec);
        if (rec === 'create_child') {
          if (nextAnalysis.suggested_child_name) {
            setChildName(nextAnalysis.suggested_child_name);
            setChildNodeType(nextAnalysis.suggested_child_type);
          }
          switchResolutionType('create_child');
        }
        else if (rec === 'create_alias') switchResolutionType('create_alias');
        else if (rec === 'merge_existing') switchResolutionType('merge_existing');
        setForceNew(false);
        toast.error('Há candidatos similares. Reveja antes de criar um sistema novo.');
        return;
      }

      toast.error(`Erro: ${readString(payload.error) || 'falha ao resolver'}`);
    } catch (error) {
      console.error('[ResolutionDrawer] erro ao resolver', error);
      toast.error('Erro ao resolver sugestão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    if (!(await confirm({ title: "Descartar sugestão", message: `Descartar "${suggestion.name}"? Ela sai da fila pendente.`, variant: "warning" }))) return;
    setSubmitting(true);
    try {
      const response = await authPost(
        `/api/v1/admin/system-suggestions/${suggestion.id}/resolve`,
        { resolution_type: 'reject' },
      );
      const json: unknown = await response.json().catch(() => ({}));
      const payload = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
      if (response.ok) {
        toast.success('Sugestão descartada.');
        onResolved({});
        return;
      }
      toast.error(`Erro: ${readString(payload.error) || 'falha ao descartar'}`);
    } catch (error) {
      console.error('[ResolutionDrawer] erro ao descartar', error);
      toast.error('Erro ao descartar sugestão.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-[#0F1A2E] border-l border-white/10 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Resolver sugestão</h2>
            <p className="text-white/60 text-sm mt-1">{suggestion.name}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none" aria-label="Fechar">
            ×
          </button>
        </div>

        {/* 1. Sugestao original */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wide">Sugestão original</p>
          <p className="text-white font-medium mt-1">{suggestion.name}</p>
          {suggestion.description && <p className="text-white/60 text-sm mt-1">{suggestion.description}</p>}
        </div>

        {/* 2. Candidatos */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <p className="text-white/80 font-semibold">Candidatos no catálogo</p>
            {recommended && RECOMMENDED_LABELS[recommended] && (
              <span className="text-xs px-2 py-1 rounded bg-blue-600/30 text-blue-200 border border-blue-500/40">
                Sugerido: {RECOMMENDED_LABELS[recommended]}
              </span>
            )}
          </div>
          {loading ? (
            <p className="text-white/50 text-sm mt-2">Calculando candidatos…</p>
          ) : candidates.length === 0 ? (
            <p className="text-white/50 text-sm mt-2">Nenhum candidato similar encontrado.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {candidates.map((c) => {
                const isSelected = targetSystemId === c.system_id || parentId === c.system_id;
                const knownSystem = systemById.get(c.system_id) ?? null;
                const candidateChildren = knownSystem ? childrenByParentId.get(knownSystem.id) ?? EMPTY_SYSTEMS : EMPTY_SYSTEMS;
                const candidateAliases = knownSystem ? knownSystem.aliases : [];
                const childLabels = candidateChildren.map(
                  (child) => `${child.name}${child.name_pt ? ` / ${child.name_pt}` : ''} (${NODE_TYPE_LABELS[child.node_type] ?? child.node_type})`,
                );
                return (
                  <li
                    key={c.system_id}
                    className={`rounded-lg border p-2 transition-colors ${
                      isSelected ? 'bg-blue-600/20 border-blue-500' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{knownSystem?.name ?? c.name}</p>
                        <p className="text-white/40 text-xs truncate">
                          {knownSystem ? systemLabel(knownSystem) : `${c.node_type} · ${c.path_slug ?? c.system_id}`}
                        </p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {Math.round(c.score * 100)}% · {c.reasons.map((r) => REASON_LABELS[r] ?? r).join(', ')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          applySystemSelection(c.system_id);
                          if (c.node_type === 'system') setParentId(c.system_id);
                          toast.success(`Alvo: ${c.name}`);
                        }}
                        className={`shrink-0 text-xs px-2 py-1 rounded text-white ${
                          isSelected ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        {isSelected ? '✓ Selecionado' : 'Usar'}
                      </button>
                    </div>
                    <ContextChips label="Aliases existentes" values={candidateAliases} />
                    <ContextChips label="Filhos existentes" values={childLabels} tone="white" limit={5} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {(analysis.base || analysis.suggested_child_name || recommended) && (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-white/40 text-xs uppercase tracking-wide">Interpretação</p>
              {recommended && RECOMMENDED_LABELS[recommended] && (
                <span className="rounded bg-blue-600/20 px-2 py-1 text-xs text-blue-100">
                  {RECOMMENDED_LABELS[recommended]}
                </span>
              )}
            </div>
            <div className="mt-2 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
              <p>
                <span className="text-white/40">Base:</span> {analysis.base || suggestion.name}
              </p>
              <p>
                <span className="text-white/40">Novo item:</span> {analysis.suggested_child_name || 'não detectado'}
              </p>
              <p>
                <span className="text-white/40">Tipo sugerido:</span> {NODE_TYPE_LABELS[analysis.suggested_child_type]}
              </p>
              <p>
                <span className="text-white/40">Candidato:</span> {bestCandidate ? bestCandidate.name : 'nenhum'}
              </p>
            </div>
            {analysis.edition_tokens.length > 0 && (
              <ContextChips label="Tokens de edição detectados" values={analysis.edition_tokens} tone="amber" />
            )}
          </div>
        )}

        {/* 3. Acao escolhida */}
        <div className="mb-4">
          <p className="text-white/80 font-semibold mb-2">Ação</p>
          <div className="flex flex-wrap gap-2">
            {RESOLUTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => switchResolutionType(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  resolutionType === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Formularios por tipo */}
        <div className="space-y-3 mb-4">
          {resolutionType === 'create_chain' && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <p className="text-sm font-semibold text-blue-100">Cadeia completa</p>
              <p className="mt-1 text-sm text-blue-100/80">
                Aprova o lote inteiro ligado a esta sugestão. O backend cria cada nível em transação única e usa o nó recém-criado como pai do próximo.
              </p>
              <p className="mt-2 text-xs text-blue-100/60">
                Sugestões antigas sem lote continuam válidas como cadeia de um nó.
              </p>
            </div>
          )}

          {(resolutionType === 'create_alias' || resolutionType === 'merge_existing') && (
            <label className="block">
              <span className="text-white/70 text-sm">Sistema alvo</span>
              <SearchableSelect
                options={systemOptions}
                value={targetSystemId}
                onChange={setTargetSystemId}
                placeholder="Buscar sistema (ex.: dnd, cthulhu)"
              />
            </label>
          )}

          {resolutionType === 'create_alias' && (
            <SystemContextPanel
              title="Alias será adicionado a este sistema"
              system={targetSystem}
              children={targetChildren}
              note="Confira nomes, aliases e filhos já cadastrados antes de confirmar."
              risks={[
                ...(analysis.has_edition_context || analysis.has_qualifier_context
                  ? ['A sugestão parece edição/variante; confira a aba Edição / variante / subsistema antes de criar alias.']
                  : []),
                ...aliasMatchRisks
                  .filter((system) => system.id !== targetSystemId)
                  .map((system) => `Nome/alias igual já existe em ${systemLabel(system)}`),
              ]}
            />
          )}

          {resolutionType === 'create_alias' && (
            <RelatedActions
              items={[
                ...(analysis.has_edition_context || analysis.has_qualifier_context
                  ? [{ label: 'Criar edição/variante em vez de alias', onClick: () => switchResolutionType('create_child'), tone: 'amber' as const }]
                  : []),
                ...(targetSystem ? [{ label: 'Mesclar com este alvo', onClick: () => switchResolutionType('merge_existing'), tone: 'white' as const }] : []),
              ]}
            />
          )}

          {resolutionType === 'merge_existing' && (
            <SystemContextPanel
              title="Nada será criado"
              system={targetSystem}
              children={targetChildren}
              note="A sugestão será resolvida como item já coberto pelo catálogo. Esta ação não cria alias, edição, variante ou subsistema."
              risks={[
                ...(analysis.has_edition_context || analysis.has_qualifier_context
                  ? ['Há sinal de edição/variante na sugestão; mesclar não cria esse item.']
                  : []),
                ...(suggestedParentAlias ? [`Alias de base possível não será criado: ${suggestedParentAlias}`] : []),
              ]}
            />
          )}

          {resolutionType === 'merge_existing' && (
            <RelatedActions
              items={[
                ...(analysis.has_edition_context || analysis.has_qualifier_context
                  ? [{ label: 'Criar edição/variante', onClick: () => switchResolutionType('create_child'), tone: 'amber' as const }]
                  : []),
                { label: 'Adicionar como alias', onClick: () => switchResolutionType('create_alias'), tone: 'blue' as const },
              ]}
            />
          )}

          {resolutionType === 'create_alias' && (
            <label className="block">
              <span className="text-white/70 text-sm">Texto do alias</span>
              <input
                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                value={aliasText}
                onChange={(e) => setAliasText(e.target.value)}
              />
            </label>
          )}

          {resolutionType === 'create_child' && (
            <>
              <label className="block">
                <span className="text-white/70 text-sm">Tipo</span>
                <select
                  className="app-select w-full mt-1"
                  value={childNodeType}
                  onChange={(e) => {
                    setChildNodeType(e.target.value as 'edition' | 'variant' | 'subsystem');
                    setParentId('');
                  }}
                >
                  <option value="edition">Edição</option>
                  <option value="subsystem">Subsistema</option>
                  <option value="variant">Variante</option>
                </select>
              </label>
              <label className="block">
                <span className="text-white/70 text-sm">Sistema pai</span>
                <SearchableSelect
                  options={parentOptions}
                  value={parentId}
                  onChange={(id) => {
                    setParentId(id);
                    setTargetSystemId(id);
                  }}
                  placeholder="Buscar sistema pai"
                />
              </label>
              <SystemContextPanel
                title="Filhos já existentes neste pai"
                system={parentSystem}
                children={parentChildren}
                note="Confira edições, variantes e subsistemas existentes para evitar duplicar valores como 5e, 2024 ou 1.3."
                risks={childNameRisks.map((child) => `Nome parecido já existe: ${systemLabel(child)}`)}
              />
              {suggestedParentAlias && (
                <label className="block">
                  <span className="text-white/70 text-sm">Alias do sistema pai (opcional)</span>
                  <TagInput
                    value={parentAliases}
                    onChange={setParentAliases}
                    placeholder="Digite e Enter (ex.: O Um Anel)"
                  />
                  <span className="text-white/40 text-xs mt-1 block">
                    Adiciona nomes da base ao sistema pai enquanto cria a edição/variante.
                  </span>
                </label>
              )}
              <RelatedActions
                items={[
                  ...(parentSystem ? [{ label: 'Usar só como alias', onClick: () => switchResolutionType('create_alias'), tone: 'white' as const }] : []),
                  ...(parentSystem ? [{ label: 'Mesclar sem criar nada', onClick: () => switchResolutionType('merge_existing'), tone: 'white' as const }] : []),
                ]}
              />
            </>
          )}

          {(resolutionType === 'create_child' || resolutionType === 'create_system') && (
            <>
              <label className="block">
                <span className="text-white/70 text-sm">Nome</span>
                <input
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  value={resolutionType === 'create_child' ? childName : rootName}
                  onChange={(e) => {
                    if (resolutionType === 'create_child') {
                      setChildName(e.target.value);
                    } else {
                      setRootName(e.target.value);
                    }
                  }}
                />
              </label>
              <label className="block">
                <span className="text-white/70 text-sm">Nome PT (opcional)</span>
                <input
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  value={namePt}
                  onChange={(e) => setNamePt(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-white/70 text-sm">Descrição (opcional)</span>
                <textarea
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-white/70 text-sm">Apelidos (opcional)</span>
                <TagInput
                  value={aliases}
                  onChange={setAliases}
                  placeholder="Digite e Enter (ex.: M&M, Mutantes & Malfeitores)"
                />
                <span className="text-white/40 text-xs mt-1 block">
                  Nomes alternativos PT/EN, siglas e variações. Enter ou vírgula adiciona.
                </span>
              </label>
            </>
          )}

          {resolutionType === 'create_system' && (
            <label className="block">
              <span className="text-white/70 text-sm">Edição específica (opcional)</span>
              <div className="flex gap-2 mt-1">
                <input
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  value={editionName}
                  onChange={(e) => setEditionName(e.target.value)}
                  placeholder="ex.: 1.3, 5e, 2024"
                />
                <button
                  type="button"
                  onClick={splitEdition}
                  className="shrink-0 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                >
                  Separar do nome
                </button>
              </div>
              <span className="text-white/40 text-xs mt-1 block">
                Cria a raiz e, se preenchido, uma edição abaixo dela (ex.: CAIN → CAIN/1.3).
              </span>
            </label>
          )}

          {resolutionType === 'create_system' && createSystemRiskLabels.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-200/70">Risco antes de criar raiz nova</p>
              <p className="mt-1 text-sm text-amber-100">
                Já existem candidatos parecidos. Confira aliases e filhos acima antes de forçar criação.
              </p>
              <ContextChips label="Candidatos similares" values={createSystemRiskLabels} tone="amber" limit={6} />
            </div>
          )}

          {resolutionType === 'create_system' && createSystemRiskLabels.length > 0 && (
            <RelatedActions
              items={[
                { label: 'Criar como edição/variante', onClick: () => switchResolutionType('create_child'), tone: 'amber' as const },
                { label: 'Usar como alias', onClick: () => switchResolutionType('create_alias'), tone: 'amber' as const },
                { label: 'Mesclar com existente', onClick: () => switchResolutionType('merge_existing'), tone: 'amber' as const },
              ]}
            />
          )}

          {resolutionType === 'create_system' && candidates.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-amber-300">
              <input type="checkbox" checked={forceNew} onChange={(e) => setForceNew(e.target.checked)} className="h-4 w-4" />
              Criar mesmo havendo candidatos similares
            </label>
          )}

          {resolutionType === 'reject' && (
            <label className="block">
              <span className="text-white/70 text-sm">Motivo (opcional)</span>
              <textarea
                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}

          {(resolutionType === 'create_alias' || resolutionType === 'merge_existing' || resolutionType === 'create_child' || resolutionType === 'create_system') && (
            <label className="block">
              <span className="text-white/70 text-sm">Notas internas (opcional)</span>
              <input
                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          )}
        </div>

        {/* 4. Previa */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wide">Prévia do efeito</p>
          <p className="text-white/80 text-sm mt-1 break-words">{preview}</p>
        </div>

        {/* 5. Acoes */}
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10">
            Cancelar
          </button>
          <button
            onClick={handleDiscard}
            disabled={submitting || loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 mr-auto"
          >
            Descartar sugestão
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Resolvendo…' : 'Confirmar resolução'}
          </button>
        </div>
      </div>
    </div>
  );
};
