import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Compass, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { SystemTreeSelector } from '../components/SystemTreeSelector';
import type { SystemTreeNode } from '../types/systems';
import { applySeo } from '../utils/seo';
import { authGet, authPut } from '../services/apiClient';

interface OptionItem {
  id: string;
  name: string;
  slug: string;
}

interface MePayload {
  data: {
    profile: {
      display_name: string;
      bio: string | null;
      languages: string[];
    } | null;
    preferences: {
      systems: string[];
      tags: string[];
      languages: string[];
      platforms: string[];
      weekdays: number[];
    };
    onboarding_completed: boolean;
  };
}

interface OptionsPayload {
  data: {
    systems: OptionItem[];
    systems_tree?: SystemTreeNode[];
    tags: OptionItem[];
    platforms: OptionItem[];
  };
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const LANGUAGE_OPTIONS = ['Português', 'Inglês', 'Espanhol'];

const toggleArrayValue = <T,>(list: T[], value: T): T[] => {
  if (list.includes(value)) return list.filter((item) => item !== value);
  return [...list, value];
};

const flattenSystemTree = (nodes: SystemTreeNode[]): SystemTreeNode[] => {
  const result: SystemTreeNode[] = [];

  const visit = (node: SystemTreeNode) => {
    result.push(node);
    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return result;
};

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<{ systemsTree: SystemTreeNode[]; tags: OptionItem[]; platforms: OptionItem[] }>({
    systemsTree: [],
    tags: [],
    platforms: [],
  });

  const [systemSearch, setSystemSearch] = useState('');

  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    systems: [] as string[],
    tags: [] as string[],
    languages: ['Português'] as string[],
    platforms: [] as string[],
    weekdays: [] as number[],
  });

  useEffect(() => {
    applySeo(
      'Onboarding | Artifício Mesas',
      'Configure seu perfil e preferências de RPG para receber recomendações personalizadas.'
    );
  }, []);

  useEffect(() => {
    if (!user || !isAuthenticated) {
      navigate('/');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [meRes, optionsRes] = await Promise.all([
          authGet('/api/v1/me'),
          authGet('/api/v1/me/options'),
        ]);

        if (!meRes.ok || !optionsRes.ok) {
          throw new Error('Não foi possível carregar seus dados de onboarding.');
        }

        const meJson = (await meRes.json()) as MePayload;
        const optionsJson = (await optionsRes.json()) as OptionsPayload;

        if (meJson.data.onboarding_completed) {
          navigate('/');
          return;
        }

        setOptions({
          systemsTree: Array.isArray(optionsJson.data.systems_tree) ? optionsJson.data.systems_tree : [],
          tags: Array.isArray(optionsJson.data.tags) ? optionsJson.data.tags : [],
          platforms: Array.isArray(optionsJson.data.platforms) ? optionsJson.data.platforms : [],
        });

        setForm({
          display_name: meJson.data.profile?.display_name ?? user.name ?? '',
          bio: meJson.data.profile?.bio ?? '',
          systems: Array.isArray(meJson.data.preferences.systems) ? meJson.data.preferences.systems : [],
          tags: Array.isArray(meJson.data.preferences.tags) ? meJson.data.preferences.tags : [],
          languages:
            meJson.data.preferences.languages && meJson.data.preferences.languages.length > 0
              ? meJson.data.preferences.languages
              : ['Português'],
          platforms: Array.isArray(meJson.data.preferences.platforms) ? meJson.data.preferences.platforms : [],
          weekdays: Array.isArray(meJson.data.preferences.weekdays) ? meJson.data.preferences.weekdays : [],
        });
      } catch (err: unknown) {
        setError(err instanceof Error && err.message ? err.message : 'Falha ao carregar onboarding.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, isAuthenticated, user]);

  const systemLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of flattenSystemTree(options.systemsTree)) {
      map.set(node.id, node.name);
    }
    return map;
  }, [options.systemsTree]);

  const canNextFromStep1 = form.display_name.trim().length >= 2;
  const canNextFromStep2 = form.systems.length > 0;

  const goNext = () => {
    if (step === 1 && canNextFromStep1) setStep(2);
    if (step === 2 && canNextFromStep2) setStep(3);
  };

  const goBack = () => {
    if (step === 3) setStep(2);
    if (step === 2) setStep(1);
  };

  const submitOnboarding = async () => {
    if (!isAuthenticated) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await authPut('/api/v1/me/preferences', {
        display_name: form.display_name,
        bio: form.bio,
        systems: form.systems,
        tags: form.tags,
        languages: form.languages,
        platforms: form.platforms,
        weekdays: form.weekdays,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Erro ao salvar onboarding.');
      }

      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Erro ao salvar onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center">
        <div className="animate-pulse text-white/70">Preparando seu onboarding...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-artificio-orange)]/20 text-[var(--color-artificio-orange)] flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Onboarding de Preferências</h1>
              <p className="text-sm text-white/60">3 etapas para personalizar sua experiência no Artifício Mesas</p>
            </div>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Etapa {step} de 3</div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-2xl">
          <div className="w-full h-2 rounded-full bg-white/10 mb-8 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-artificio-orange)] to-yellow-400 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          {step === 1 && (
            <div className="space-y-6" id="onboarding-step-1">
              <h2 className="text-xl font-bold">Etapa 1 · Dados básicos</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="onboarding-display-name" className="text-sm text-white/70 block mb-1">Nome de exibição *</label>
                  <input
                    id="onboarding-display-name"
                    value={form.display_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
                    className="w-full rounded-xl border border-white/15 bg-[#13213f] px-4 py-3 outline-none focus:border-[var(--color-artificio-orange)]"
                    placeholder="Como você quer aparecer na comunidade"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="onboarding-bio" className="text-sm text-white/70 block mb-1">Bio curta</label>
                  <textarea
                    id="onboarding-bio"
                    value={form.bio}
                    onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-white/15 bg-[#13213f] px-4 py-3 outline-none focus:border-[var(--color-artificio-orange)]"
                    placeholder="Conte rapidamente o que você curte em RPG"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8" id="onboarding-step-2">
              <h2 className="text-xl font-bold">Etapa 2 · Suas preferências</h2>

              <div>
                <label className="text-sm text-white/70 block mb-2">Sistemas favoritos * (mínimo 1)</label>
                <SystemTreeSelector
                  tree={options.systemsTree}
                  selectedIds={form.systems}
                  onToggle={(systemId) => setForm((prev) => ({ ...prev, systems: toggleArrayValue(prev.systems, systemId) }))}
                  search={systemSearch}
                  onSearchChange={setSystemSearch}
                  idPrefix="onboarding-systems"
                />
              </div>

              <div>
                <h3 className="text-sm text-white/70 mb-2">Temas e estilos</h3>
                <div className="grid md:grid-cols-3 gap-2">
                  {options.tags.map((tag) => {
                    const selected = form.tags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        id={`onboarding-tag-${tag.slug}`}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, tags: toggleArrayValue(prev.tags, tag.id) }))}
                        className={`px-3 py-2 rounded-lg border text-left transition-colors ${selected ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'}`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm text-white/70 mb-2">Idiomas</h3>
                  <div className="space-y-2">
                    {LANGUAGE_OPTIONS.map((language) => (
                      <button
                        key={language}
                        id={`onboarding-language-${language.toLowerCase()}`}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, languages: toggleArrayValue(prev.languages, language) }))}
                        className={`w-full px-3 py-2 rounded-lg border text-left transition-colors ${form.languages.includes(language) ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'}`}
                      >
                        {language}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm text-white/70 mb-2">Plataformas preferidas</h3>
                  <div className="space-y-2 max-h-44 overflow-auto pr-1">
                    {options.platforms.map((platform) => (
                      <button
                        key={platform.id}
                        id={`onboarding-platform-${platform.slug}`}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, platforms: toggleArrayValue(prev.platforms, platform.id) }))}
                        className={`w-full px-3 py-2 rounded-lg border text-left transition-colors ${form.platforms.includes(platform.id) ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'}`}
                      >
                        {platform.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm text-white/70 mb-2">Dias da semana disponíveis</h3>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {WEEKDAY_OPTIONS.map((weekday) => (
                    <button
                      key={weekday.value}
                      id={`onboarding-weekday-${weekday.value}`}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, weekdays: toggleArrayValue(prev.weekdays, weekday.value) }))}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${form.weekdays.includes(weekday.value) ? 'bg-[var(--color-artificio-orange)]/25 border-[var(--color-artificio-orange)] text-white' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'}`}
                    >
                      {weekday.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6" id="onboarding-step-3">
              <h2 className="text-xl font-bold">Etapa 3 · Confirmação</h2>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-200">
                <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4" />Tudo pronto!</p>
                <p className="text-sm text-emerald-100/80 mt-1">Revise rapidamente seus dados e finalize.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 mb-1">Nome</p>
                  <p className="font-semibold">{form.display_name}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white/60 mb-1">Sistemas favoritos</p>
                  <p className="font-semibold">{form.systems.length} selecionado(s)</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                  <p className="text-white/60 mb-1">Exemplo dos sistemas selecionados</p>
                  <p className="font-semibold text-white/90">
                    {form.systems.length === 0
                      ? 'Nenhum sistema selecionado.'
                      : form.systems
                        .slice(0, 4)
                        .map((id) => systemLabelById.get(id) ?? 'Sistema desconhecido')
                        .join(' · ')}
                    {form.systems.length > 4 ? ' ...' : ''}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                  <p className="text-white/60 mb-1">Bio</p>
                  <p className="font-semibold text-white/90">{form.bio || 'Sem bio preenchida.'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 text-sm text-white/80">
                <p className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[var(--color-artificio-orange)]" />Suas preferências serão usadas para melhorar recomendações na home e filtros salvos.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" id="onboarding-error-box">
              {error}
            </div>
          )}

          <footer className="mt-8 flex items-center justify-between">
            <button
              type="button"
              id="btn-onboarding-voltar"
              onClick={goBack}
              disabled={step === 1 || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white/80 disabled:opacity-40 disabled:cursor-not-allowed hover:border-white/30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>

            {step < 3 ? (
              <button
                type="button"
                id="btn-onboarding-proximo"
                onClick={goNext}
                disabled={(step === 1 && !canNextFromStep1) || (step === 2 && !canNextFromStep2)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                id="btn-onboarding-finalizar"
                onClick={submitOnboarding}
                disabled={submitting}
                className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {submitting ? 'Finalizando...' : 'Finalizar onboarding'}
              </button>
            )}
          </footer>
        </section>
      </div>
    </main>
  );
};
