import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingState, TextInput } from '@artificio/ui';
import { useProfileContext } from '../contexts/useProfileContext';
import type { PlayerProfile, GmProfile } from '../types/profileTypes';
import { UserSystemsSelector } from '../components/UserSystemsSelector';
import { LinksManager } from '../components/LinksManager';
import { showSuccess, showError } from '../utils/toast';
import { track } from '../services/analytics';
import { AvatarField } from '../components/AvatarField';
import { ImageUploader } from '../components/ImageUploader';
import { isCropRect } from '@artificio/media/image-kinds';
import { MarkdownEditor } from '../components/MarkdownEditor';
// Campos do editor de mestre consolidados num único arquivo (spec 099, fase B
// pós-B5): componentes e props inalterados, só a casa mudou. B6: `bio_long` e
// `experience_years` saíram do JSX da TabMestre para cá (BioLongField/
// ExperienceYearsField) — mesmo markup, visual preservado — para o teste
// cruzado alcançar o `data-ob` deles.
import {
  TaglineField,
  ClosedGroupSection,
  ProfileTagsSection,
  SellingPointsEditor,
  PromoBadgeField,
  BioLongField,
  ExperienceYearsField,
} from '../components/mestre/editor/GmProfileFields';
// Spec 099 fase G: a casca do editor de mestre (lateral com as 5 partes,
// pendências e a porta para o link oficial). A `MestreProfilePreview` que a
// B10 montava aqui saiu: o espelho virou porta (§13.11).
import { ProfileEditorSidebar } from '../components/mestre/editor/ProfileEditorSidebar';
import {
  PROFILE_PARTS,
  profilePartDomId,
  computeProfilePendingCounts,
  computeProfileProgress,
  type ProfilePartId,
} from '../components/mestre/editor/profileEditorParts';
import { useLinks } from '../hooks/useLinks';
import { authPost } from '../utils/authenticatedFetch';
import './ProfileEditPage.css';

/**
 * Página de edição de perfil com tabs
 * Tabs: Geral | Jogador | Mestre
 * Autosave com debounce 500ms (spec 099 B8): o debounce real vive no
 * `ProfileContext.updateGm` — esta página só reflete o estado no indicador.
 */

type TabType = 'geral' | 'jogador' | 'mestre';

const VALID_TABS: TabType[] = ['geral', 'jogador', 'mestre'];

const sanitizeTab = (tab: string | null): TabType => {
  return VALID_TABS.includes(tab as TabType) ? (tab as TabType) : 'geral';
};

export default function ProfileEditPage() {
  const { profile, loading, saving, error, saveError } = useProfileContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = sanitizeTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [showSaved, setShowSaved] = useState(false);

  // Sincroniza a aba com a URL — ajuste durante o render (sem effect).
  const [prevTabUrl, setPrevTabUrl] = useState(tabFromUrl);
  if (prevTabUrl !== tabFromUrl) {
    setPrevTabUrl(tabFromUrl);
    if (activeTab !== tabFromUrl) setActiveTab(tabFromUrl);
  }

  // Sincronizar aba com URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    track('profile_tab_changed', { from: activeTab, to: tab });
  };

  // Feedback de autosave com timeout. setState deferido p/ fora do corpo síncrono.
  // Só dispara na transição saving: true→false (não no load inicial). Se a última
  // gravação falhou (saveError), NÃO mostra "Salvo" — o indicador fica no estado
  // de erro até a próxima gravação bem-sucedida limpar o erro.
  const prevSavingRef = useRef(saving);
  useEffect(() => {
    const wasSaving = prevSavingRef.current;
    prevSavingRef.current = saving;
    if (saving || !profile || !wasSaving) return;
    // Gravação falhou: garante "Salvo" apagado (o indicador mostra o erro).
    const nextSaved = !saveError;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setShowSaved(nextSaved);
      if (nextSaved) timer = setTimeout(() => setShowSaved(false), 2000);
    })();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [saving, profile, saveError]);

  // Discord: NENHUM código de conexão vive mais neste arquivo (2026-09-01,
  // decisão do mantenedor). A seção da UI saíra em 2026-08-27 como "adiada", e
  // o `useEffect` que lia `?discord=connected|error` ficara para atender quem
  // voltasse de um fluxo já iniciado. A decisão agora é outra: a integração
  // será **reescrita do zero** quando for a hora, então não há fluxo antigo a
  // atender nem bloco a reintroduzir — manter o handler só deixava código morto
  // esperando por uma feature que não vai voltar nesta forma.
  //
  // O backend continua servindo `/auth/discord/*` (`discord.ts`, montado em
  // `server.ts:118`) e os campos `discord_connected`/`discord_username`/
  // `covil_verified` seguem exibidos no perfil público — nada foi removido do
  // servidor. Quem chegar em `/perfil?discord=...` por link direto vê a query
  // string ignorada, sem aviso: consequência aceita, porque o front não tem
  // mais como iniciar esse fluxo (medido: zero referências a
  // `auth/discord`/`discord/connect` fora de comentário).

  // O handler de desconexão do Discord saiu junto com a seção adiada
  // (2026-08-27). `DELETE /auth/discord/disconnect` continua existindo no
  // backend — só não há mais botão que o chame.

  if (loading) {
    return (
      <div className="profile-edit-page">
        <LoadingState variant="page" message="Carregando perfil..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-edit-page">
        <div className="error-state">
          <p>❌ {error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-edit-page">
        <div className="error-state">
          <p>Perfil não encontrado</p>
        </div>
      </div>
    );
  }

  // Estado do indicador de autosave, derivado UMA vez (achado do Sonar na
  // PR #304: ternário aninhado). A prioridade — erro > salvando > salvo —
  // estava escrita duas vezes, na classe e no corpo, o que deixava as duas
  // livres para divergir numa edição futura. Agora a ordem dos `if` É a
  // prioridade, e ela existe num lugar só.
  const autosaveState = resolveAutosaveState({ saveError, saving, showSaved });

  return (
    <div className="profile-edit-page">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.profile?.avatar_url ? (
            <img src={profile.profile.avatar_url} alt="Avatar" />
          ) : (
            <div className="avatar-placeholder">
              {profile.profile?.display_name?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-main">
            <div className="profile-name-row">
              <h1>{profile.profile?.display_name || 'Sem nome'}</h1>
              {profile.user.role === 'gm' && (
                <span className="profile-role-badge badge-gm">Mestre</span>
              )}
              {profile.user.role === 'admin' && (
                <span className="profile-role-badge badge-admin">Admin</span>
              )}
            </div>
            <p className="profile-email">{profile.user.email}</p>
            {profile.user.username && (
              <p className="profile-username">@{profile.user.username}</p>
            )}
          </div>
          <div className="profile-meta">
            {profile.gm?.slug && (
              <Button
                href={`/mestre/${profile.gm.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
                title="Abrir perfil público em nova aba"
                leftIcon={<span>👁️</span>}
              >
                Ver perfil público
              </Button>
            )}
            {/* Spec 099 B8: o indicador fica SEMPRE montado (antes só existia
                durante saving/salvo — medido em runtime, §11.1, que na aba
                mestre ele estava AUSENTE do DOM). O CSS o mantém fixo no
                viewport (`position: fixed`), então a aba de 3,75 telas não
                o rola para fora. Estados: saving / saved / error, nesta
                prioridade — `title` carrega o detalhe do erro. */}
            <div
              className={`autosave-indicator ${autosaveState}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              title={saveError ?? undefined}
            >
              {autosaveState === 'error' && <span>Erro ao salvar</span>}
              {autosaveState === 'saving' && (
                <>
                  <span className="artificio-button-spinner" aria-hidden="true"></span>
                  <span>Salvando…</span>
                </>
              )}
              {autosaveState === 'saved' && (
                <>
                  <span>✓</span>
                  <span>Salvo</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'geral'}
          aria-controls="tab-panel-geral"
          id="tab-geral"
          tabIndex={activeTab === 'geral' ? 0 : -1}
          className={`tab ${activeTab === 'geral' ? 'active' : ''}`}
          onClick={() => handleTabChange('geral')}
        >
          Geral
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'jogador'}
          aria-controls="tab-panel-jogador"
          id="tab-jogador"
          tabIndex={activeTab === 'jogador' ? 0 : -1}
          className={`tab ${activeTab === 'jogador' ? 'active' : ''}`}
          onClick={() => handleTabChange('jogador')}
        >
          Jogador
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'mestre'}
          aria-controls="tab-panel-mestre"
          id="tab-mestre"
          tabIndex={activeTab === 'mestre' ? 0 : -1}
          className={`tab ${activeTab === 'mestre' ? 'active' : ''}`}
          onClick={() => handleTabChange('mestre')}
        >
          Mestre
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'geral' && (
          <div
            id="tab-panel-geral"
            role="tabpanel"
            aria-labelledby="tab-geral"
          >
            <TabGeral />
          </div>
        )}
        {activeTab === 'jogador' && (
          <div
            id="tab-panel-jogador"
            role="tabpanel"
            aria-labelledby="tab-jogador"
          >
            <TabJogador />
          </div>
        )}
        {activeTab === 'mestre' && (
          <div
            id="tab-panel-mestre"
            role="tabpanel"
            aria-labelledby="tab-mestre"
          >
            <TabMestre />
          </div>
        )}
      </div>
    </div>
  );
}

type AutosaveState = 'error' | 'saving' | 'saved' | '';

/**
 * Estado visível do indicador de autosave (spec 099 B8).
 *
 * Prioridade: erro > salvando > salvo. Erro vem primeiro de propósito — se a
 * última gravação falhou, mostrar "Salvo" mentiria sobre o que está no
 * servidor. A ordem dos `if` é a prioridade; não há ternário aninhado a ler de
 * dentro para fora (achado do Sonar, PR #304).
 */
function resolveAutosaveState(
  input: Readonly<{ saveError: string | null; saving: boolean; showSaved: boolean }>,
): AutosaveState {
  if (input.saveError) return 'error';
  if (input.saving) return 'saving';
  if (input.showSaved) return 'saved';
  return '';
}

// O upload de arquivo vive em `useImageUpload`: o helper local daqui nao
// enviava o `purpose`, entao o servidor cortava o avatar como banner de mesa.
async function fetchGoogleAvatar(): Promise<string> {
  const response = await authPost('/api/v1/profile/me/google-picture');
  const payload = await response.json();
  if (!response.ok || typeof payload?.data?.avatar_url !== 'string') {
    throw new Error(payload?.error || 'Erro ao buscar foto do Google.');
  }
  return payload.data.avatar_url;
}

// =============================================================================
// TAB GERAL
// =============================================================================

function TabGeral() {
  const { profile, updateUser, updateProfile } = useProfileContext();
  const [bio, setBio] = useState(profile?.profile?.bio || '');
  const currentAvatar = profile?.profile?.avatar_url || '';

  if (!profile) return null;

  return (
    <div className="tab-geral">
      <section className="form-section">
        <h2>Informações Básicas</h2>

        <AvatarField
          idPrefix="avatar"
          label="Foto de Perfil"
          description="Esta é a sua foto de usuário. Ela aparece em comentários, avaliações e no cabeçalho do site."
          value={{
            url: currentAvatar,
            crop: isCropRect(profile.profile?.avatar_crop_data) ? profile.profile.avatar_crop_data : null,
            width: profile.profile?.avatar_width ?? null,
            height: profile.profile?.avatar_height ?? null,
          }}
          onChange={(next) =>
            updateProfile({
              avatar_url: next.url,
              avatar_crop_data: next.crop,
              avatar_width: next.width,
              avatar_height: next.height,
            })
          }
          placeholderInitial={profile.profile?.display_name?.charAt(0).toUpperCase() || '?'}
          onUseGooglePhoto={fetchGoogleAvatar}
          onNotice={showSuccess}
          onError={showError}
        />

        <div className="form-group">
          <label htmlFor="display_name">Nome de Exibição</label>
          {/* Fase G/G5: os 3 inputs crus da aba Geral passam ao primitivo do
              pacote. Enquanto a regra legada `.form-group input[...]` declarava
              padding/font-size/min-height, eles herdavam a escala dela por
              acidente de cascata; com a regra corrigida (§13.7) cairiam para o
              tamanho default do navegador. Achado do Codex na PR #304. */}
          <TextInput
            type="text"
            id="display_name"
            defaultValue={profile.profile?.display_name || ''}
            onChange={(e) => updateProfile({ display_name: e.target.value })}
            placeholder="Como você quer ser chamado?"
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">Username (URL pública)</label>
          <TextInput
            type="text"
            id="username"
            defaultValue={profile.user.username || ''}
            onChange={(e) => updateUser({ username: e.target.value })}
            placeholder="seu-username"
            pattern="[a-zA-Z0-9_]+"
          />
          <small>Apenas letras, números e underscore. Será usado na URL do seu perfil.</small>
        </div>

        <div className="form-group">
          <label>Bio</label>
          <MarkdownEditor
            value={bio}
            onChange={(text) => { setBio(text); updateProfile({ bio: text }); }}
            label="Bio"
            placeholder="Conte um pouco sobre você..."
            height={200}
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">Localização</label>
          <TextInput
            type="text"
            id="location"
            defaultValue={profile.user.location || ''}
            onChange={(e) => updateUser({ location: e.target.value })}
            placeholder="Cidade, Estado"
          />
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// TAB JOGADOR
// =============================================================================

function TabJogador() {
  const { profile, updatePlayer, addSystem, removeSystem } = useProfileContext();

  if (!profile) return null;

  const playerProfile = (profile.player || {}) as Partial<PlayerProfile>;

  return (
    <div className="tab-jogador">
      <section className="form-section">
        <h2>Perfil de Jogador</h2>

        <div className="form-group">
          <label htmlFor="experience_level">Nível de Experiência</label>
          <select
            id="experience_level"
            defaultValue={playerProfile.experience_level || ''}
            className="app-select w-full"
            onChange={(e) =>
              updatePlayer({
                experience_level: e.target.value as 'iniciante' | 'intermediario' | 'veterano',
              })
            }
          >
            <option value="">Selecione...</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="veterano">Veterano</option>
          </select>
        </div>

        <div className="form-group">
          <label>Estilo de Jogo (1-5)</label>
          <div className="playstyle-grid">
            <div className="playstyle-item">
              <label htmlFor="combat">
                Combate
                <span>{playerProfile.playstyle?.combat || 3}</span>
              </label>
              <input
                type="range"
                id="combat"
                min="1"
                max="5"
                defaultValue={playerProfile.playstyle?.combat || 3}
                onChange={(e) =>
                  updatePlayer({
                    playstyle: {
                      ...playerProfile.playstyle,
                      combat: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>

            <div className="playstyle-item">
              <label htmlFor="roleplay">
                Socialização
                <span>{playerProfile.playstyle?.roleplay || 3}</span>
              </label>
              <input
                type="range"
                id="roleplay"
                min="1"
                max="5"
                defaultValue={playerProfile.playstyle?.roleplay || 3}
                onChange={(e) =>
                  updatePlayer({
                    playstyle: {
                      ...playerProfile.playstyle,
                      roleplay: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>

            <div className="playstyle-item">
              <label htmlFor="exploration">
                Exploração
                <span>{playerProfile.playstyle?.exploration || 3}</span>
              </label>
              <input
                type="range"
                id="exploration"
                min="1"
                max="5"
                defaultValue={playerProfile.playstyle?.exploration || 3}
                onChange={(e) =>
                  updatePlayer({
                    playstyle: {
                      ...playerProfile.playstyle,
                      exploration: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>

            <div className="playstyle-item">
              <label htmlFor="strategy">
                Estratégia
                <span>{playerProfile.playstyle?.strategy || 3}</span>
              </label>
              <input
                type="range"
                id="strategy"
                min="1"
                max="5"
                defaultValue={playerProfile.playstyle?.strategy || 3}
                onChange={(e) =>
                  updatePlayer({
                    playstyle: {
                      ...playerProfile.playstyle,
                      strategy: parseInt(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="preferred_time">Horário Preferido</label>
          <select
            id="preferred_time"
            defaultValue={playerProfile.preferred_time || ''}
            className="app-select w-full"
            onChange={(e) =>
              updatePlayer({ preferred_time: e.target.value as 'manha' | 'tarde' | 'noite' })
            }
          >
            <option value="">Selecione...</option>
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pricing_preference">Preferência de Preço</label>
          <select
            id="pricing_preference"
            defaultValue={playerProfile.pricing_preference || ''}
            className="app-select w-full"
            onChange={(e) =>
              updatePlayer({ pricing_preference: e.target.value as 'free' | 'paid' | 'both' })
            }
          >
            <option value="">Selecione...</option>
            <option value="free">Apenas gratuitas</option>
            <option value="paid">Apenas pagas</option>
            <option value="both">Ambas</option>
          </select>
        </div>
      </section>

      <section className="form-section">
        <h2>Sistemas Favoritos</h2>
        <p className="section-description">
          Sistemas que você gosta de jogar
        </p>
        <UserSystemsSelector
          type="favorite"
          selectedSystemIds={profile.systems.favorite.map((s) => s.system_id)}
          onAdd={(systemId) => addSystem(systemId, 'favorite')}
          onRemove={(id) => {
            const system = profile.systems.favorite.find((s) => s.system_id === id);
            if (system) removeSystem(system.id);
          }}
        />
      </section>
    </div>
  );
}

// =============================================================================
// TAB MESTRE
// =============================================================================

// As props `onDisconnectDiscord`/`disconnecting` e o estado `connecting` saíram
// junto com a seção Discord (adiada em 2026-08-27) — só existiam para ela.
function TabMestre() {
  const { profile, updateGm, addSystem, removeSystem, flushGm } = useProfileContext();
  const { links } = useLinks();
  const gmProfile = (profile?.gm || {}) as Partial<GmProfile>;
  const [bannerHasError, setBannerHasError] = useState(false);

  // Casca do editor (spec 099, fase G): parte ativa da lateral. A troca é por
  // ÂNCORA, não por view — todas as partes continuam montadas e o clique rola
  // até a seção. O perfil é edição de dado existente, não funil: esconder o
  // resto destruiria a revisão livre, que é a força do documento contínuo.
  const [activePartId, setActivePartId] = useState<ProfilePartId>('quem');

  const linkCount = Array.isArray(links) ? links.length : 0;
  const pendingCounts = computeProfilePendingCounts(profile?.gm, linkCount);
  const progress = computeProfileProgress(profile?.gm, linkCount);

  // Marca a parte ativa conforme o mestre rola: a lateral acompanha a leitura
  // em vez de só responder a clique. `rootMargin` superior de -104px é a altura
  // do header sticky do AppShell — sem ele, a seção contaria como visível
  // enquanto ainda está escondida atrás do header.
  const partsContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = partsContainerRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const sections = PROFILE_PARTS.map((part) =>
      root.querySelector<HTMLElement>(`#${profilePartDomId(part.id)}`),
    ).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    // Estado de visibilidade acumulado por seção. O callback recebe apenas as
    // seções que MUDARAM de estado, não todas: decidir só com `entries` faz a
    // parte ativa saltar para uma seção que apenas saiu de vista, enquanto a
    // que continua visível — e é a resposta certa — não está na lista.
    const visibility = new Map<string, DOMRectReadOnly | null>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(
            entry.target.id,
            entry.isIntersecting ? entry.boundingClientRect : null,
          );
        }

        // A parte ativa é a mais alta entre as visíveis: rolando para baixo, a
        // seguinte só assume quando de fato encosta no topo da leitura.
        let topId: string | null = null;
        let topOffset = Number.POSITIVE_INFINITY;
        for (const [id, rect] of visibility) {
          if (rect && rect.top < topOffset) {
            topOffset = rect.top;
            topId = id;
          }
        }
        if (!topId) return;

        const part = PROFILE_PARTS.find((p) => profilePartDomId(p.id) === topId);
        if (part) setActivePartId(part.id);
      },
      { rootMargin: '-104px 0px -55% 0px', threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  if (!profile) return null;

  const handleSelectPart = (partId: ProfilePartId) => {
    setActivePartId(partId);
    const target = document.getElementById(profilePartDomId(partId));
    // `scroll-margin-top` da seção (ProfileEditPage.css) tira o título de baixo
    // do header sticky; sem ele o mestre clicaria e cairia num título invisível.
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Endereço público real (§13.15): a rota canônica é `/mestre/<slug>` — a que
  // tem os 5 consumidores no app, incluindo o "Ver perfil público" do topo
  // desta página. `/mestres/:masterId` existe mas tem 0 links.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = profile.gm?.slug ? `${origin}/mestre/${profile.gm.slug}` : null;

  return (
    <div className="profile-editor-shell">
      <aside className="profile-editor-aside" aria-label="Partes do perfil de mestre">
        <ProfileEditorSidebar
          activePartId={activePartId}
          pendingCounts={pendingCounts}
          progress={progress}
          onSelect={handleSelectPart}
          publicUrl={publicUrl}
          onBeforeOpen={flushGm}
        />
      </aside>

      {/* Documento contínuo: as 5 partes de spec §13.5 como seções tituladas,
          agrupadas pela PERGUNTA DO JOGADOR que respondem (§0), não por tipo de
          campo. Nenhum campo foi reescrito — todos foram redistribuídos. */}
      <div className="tab-mestre" ref={partsContainerRef}>
        <ProfilePart id="quem">
          {/* As duas imagens JUNTAS (achado do mantenedor, 2026-09-01): avatar e
              banner são a mesma decisão visual — o mestre escolhe os dois
              olhando um para o outro, e o banner é o fundo sobre o qual o nome
              dele assenta. Separá-los obrigava a ir e voltar para julgar o
              conjunto. A legenda de dimensão de cada um vem do `imageKindHint`
              de packages/media, dentro dos próprios componentes (A14b). */}
          <AvatarField
            idPrefix="gm-avatar"
            label="Foto de Mestre"
            description="Esta é a sua foto como mestre. Ela aparece nas suas mesas e no seu perfil público de mestre. Se não definir, será usada a foto de perfil geral."
            value={{
              url: gmProfile.avatar_url || '',
              crop: isCropRect(gmProfile.avatar_crop_data) ? gmProfile.avatar_crop_data : null,
              width: gmProfile.avatar_width ?? null,
              height: gmProfile.avatar_height ?? null,
            }}
            onChange={(next) =>
              updateGm({
                avatar_url: next.url,
                avatar_crop_data: next.crop,
                avatar_width: next.width,
                avatar_height: next.height,
              })
            }
            inheritedUrl={profile.profile?.avatar_url}
            placeholderInitial={profile.profile?.display_name?.charAt(0).toUpperCase() || '?'}
            onUseGooglePhoto={fetchGoogleAvatar}
            onNotice={showSuccess}
            onError={showError}
            removeLabel="Remover foto de mestre"
          />

          {/* O backend ja aceitava `banner_url` do mestre (`PUT /gm/profile`) e a
              coluna existia, mas nenhuma tela oferecia o campo — por isso todo
              perfil publico ficava com `banner_url: null` e caia no gradiente. */}
          <ImageUploader
            idPrefix="gm-banner"
            manualInputId="gm_banner_url"
            label="Banner do Perfil (opcional)"
            kind="profile_banner"
            value={gmProfile.banner_url || ''}
            onChange={(url) => updateGm({ banner_url: url })}
            onError={setBannerHasError}
            hasError={bannerHasError}
            initialCropData={isCropRect(gmProfile.banner_crop_data) ? gmProfile.banner_crop_data : null}
            onCropChange={(crop) => updateGm({ banner_crop_data: crop })}
            imageWidth={gmProfile.banner_width ?? null}
            imageHeight={gmProfile.banner_height ?? null}
            onDimensionsChange={(dimensions) =>
              updateGm({ banner_width: dimensions?.width ?? null, banner_height: dimensions?.height ?? null })
            }
          />

          {/* Spec 099 B1: slogan — encabeça as três cadeias (hero/OG/SEO, §2.3).
              Grava via PUT /gm/profile, uma chamada por campo (padrão da página). */}
          <TaglineField
            value={gmProfile.tagline ?? ''}
            onChange={(tagline) => updateGm({ tagline: tagline || null })}
          />

          {/* Spec 099 B6: anos de experiência — recomendado, com frase do ganho.
              Componente extraído para GmProfileFields (mesmo markup de antes). */}
          <ExperienceYearsField value={gmProfile.experience_years ?? null} />
        </ProfilePart>

        <ProfilePart id="como">
          {/* Spec 099 B6: bio detalhada — recomendado, com frase do ganho.
              Componente extraído para GmProfileFields (mesmo markup de antes). */}
          <BioLongField value={gmProfile.bio_long ?? ''} />

          {/* Spec 099 B3: specialties/languages/badges (string[], TagInput).
              `languages` aparece aqui como parte do mesmo componente, mas
              responde à pergunta de "Sua mesa" — dividir o componente por
              parte seria reescrevê-lo, e a G3 redistribui, não reescreve.
              Gravação via updateGm vive dentro do componente (testada lá). */}
          <ProfileTagsSection
            specialties={gmProfile.specialties ?? []}
            languages={gmProfile.languages ?? []}
            badges={gmProfile.badges ?? []}
          />

          {/* Spec 099 B4: selling_points — seleção entre os 14 ícones fechados
              (nunca texto livre); item inválido fica no formulário com erro e
              não é enviado. Gravação via updateGm dentro do componente. */}
          <SellingPointsEditor value={gmProfile.selling_points} />
        </ProfilePart>

        <ProfilePart id="mesa">
          <h3 className="profile-part-subtitle">Sistemas que Mestra</h3>
          <p className="section-description">
            Sistemas que você tem experiência em mestrar
          </p>
          <UserSystemsSelector
            type="gm"
            selectedSystemIds={profile.systems.gm.map((s) => s.system_id)}
            onAdd={(systemId) => addSystem(systemId, 'gm')}
            onRemove={(id) => {
              const system = profile.systems.gm.find((s) => s.system_id === id);
              if (system) removeSystem(system.id);
            }}
          />

          {/* Spec 099 B2: grupo fechado — os 4 campos + liga/desliga, todos via
              PUT /gm/profile. Chave ausente no patch NÃO entra no updateGm: o
              optimistic update espalha `...newData` sobre o cache e chave
              `undefined` apagaria o valor salvo de um campo irmão. */}
          <ClosedGroupSection
            value={{
              enabled: gmProfile.closed_group_enabled ?? false,
              systems: gmProfile.closed_group_systems ?? [],
              description: gmProfile.closed_group_description ?? '',
              min_price_cents: gmProfile.closed_group_min_price_cents ?? null,
            }}
            onChange={(patch) => {
              const data: Partial<GmProfile> = {};
              if (patch.enabled !== undefined) data.closed_group_enabled = patch.enabled;
              if (patch.systems !== undefined) data.closed_group_systems = patch.systems;
              if (patch.description !== undefined) data.closed_group_description = patch.description;
              if (patch.min_price_cents !== undefined) {
                data.closed_group_min_price_cents = patch.min_price_cents;
              }
              updateGm(data);
            }}
          />
        </ProfilePart>

        <ProfilePart id="prova">
          {/* Spec 099 B5: faixa promocional — a prova que o mestre controla
              hoje. Avaliações e selos são exibição da página pública (D3 mantém
              o sistema de avaliações fora desta spec), então esta parte não tem
              campo recomendado: sua contagem de pendências é legitimamente 0. */}
          <PromoBadgeField value={gmProfile.promo_badge_text ?? ''} />
        </ProfilePart>

        <ProfilePart id="onde">
          <LinksManager />
        </ProfilePart>
      </div>

      {/* Sem seção de Discord: a UI saiu em 2026-08-27 e o handler de retorno
          em 2026-09-01. A integração será REESCRITA do zero quando entrar de
          novo (decisão do mantenedor) — não é bloco a reintroduzir. O que
          sobrevive é do lado do servidor, intacto: rotas `/auth/discord/*` e os
          campos `discord_connected`/`discord_username`/`covil_verified`, ainda
          exibidos no perfil público. Ver o comentário no topo deste arquivo.

          Sem prévia embutida: a `MestreProfilePreview` saiu daqui na fase G
          (§13.11). O espelho foi substituído pela PORTA para o link oficial, na
          lateral — conferir o próprio perfil numa miniatura espremida é
          conferir outra coisa, e o endereço, que é o que o mestre divulga,
          ficava de fora. O componente continua existindo e em uso nas outras
          telas que o consomem. */}
    </div>
  );
}

/**
 * Uma parte do editor: seção titulada de um documento contínuo (spec 099 G3).
 *
 * O título vem do registro (`PROFILE_PARTS`), então lateral e documento não
 * podem divergir de rótulo. A pergunta do jogador aparece como subtítulo: é o
 * critério que agrupou os campos (§0), e dizê-lo ao mestre explica por que
 * aqueles campos estão juntos.
 */
function ProfilePart({
  id,
  children,
}: Readonly<{ id: ProfilePartId; children: React.ReactNode }>) {
  const meta = PROFILE_PARTS.find((part) => part.id === id);
  return (
    <section
      id={profilePartDomId(id)}
      className="form-section profile-editor-part"
      aria-label={meta?.label ?? id}
    >
      <h2>{meta?.label ?? id}</h2>
      {meta ? <p className="section-description">{meta.question}</p> : null}
      {children}
    </section>
  );
}
