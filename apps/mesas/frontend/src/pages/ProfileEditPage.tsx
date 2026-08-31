import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
// Spec 099 B10 (D5/D8): prévia do perfil público com os dados REAIS do editor.
import { MestreProfilePreview } from '../components/mestre/editor/MestreProfilePreview';
import { buildMestrePreviewData } from '../components/mestre/editor/profilePreviewMapping';
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
  const { profile, loading, saving, error, saveError, refetch } = useProfileContext();
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

  // Feedback de conexão Discord. MANTIDO apesar de a seção da UI ter sido
  // adiada (2026-08-27): o backend continua redirecionando para
  // `/perfil?discord=connected|error` (discord.ts:46/68/149/156), então quem
  // chegar por esse retorno — link direto, fluxo iniciado antes da remoção, ou
  // a retomada da feature — ainda recebe o aviso em vez de cair numa tela muda
  // com query string pendurada.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const discordStatus = params.get('discord');
    const reason = params.get('reason');
    
    if (discordStatus === 'connected') {
      showSuccess('Discord conectado com sucesso!');
      track('discord_connected');
      window.history.replaceState({}, '', '/perfil');
      refetch();
    } else if (discordStatus === 'error') {
      if (reason === 'no_gm_profile') {
        showError('Você precisa criar um perfil de Mestre antes de conectar o Discord.\n\nVá para a aba "Mestre" e preencha seus dados primeiro.', 6000);
      } else {
        showError('Erro ao conectar Discord. Tente novamente.');
      }
      track('discord_connection_failed', { error: reason });
      window.history.replaceState({}, '', '/perfil');
    }
  }, [refetch]);

  // O handler de desconexão do Discord saiu junto com a seção adiada
  // (2026-08-27). `DELETE /auth/discord/disconnect` continua existindo no
  // backend — só não há mais botão que o chame.

  if (loading) {
    return (
      <div className="profile-edit-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Carregando perfil...</p>
        </div>
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
              <a 
                href={`/mestre/${profile.gm.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-view-public-profile"
                title="Abrir perfil público em nova aba"
              >
                <span>👁️</span> Ver perfil público
              </a>
            )}
            {/* Spec 099 B8: o indicador fica SEMPRE montado (antes só existia
                durante saving/salvo — medido em runtime, §11.1, que na aba
                mestre ele estava AUSENTE do DOM). O CSS o mantém fixo no
                viewport (`position: fixed`), então a aba de 3,75 telas não
                o rola para fora. Estados: saving / saved / error, nesta
                prioridade — `title` carrega o detalhe do erro. */}
            <div
              className={`autosave-indicator ${saveError ? 'error' : saving ? 'saving' : showSaved ? 'saved' : ''}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              title={saveError ?? undefined}
            >
              {saveError ? (
                <span>Erro ao salvar</span>
              ) : saving ? (
                <>
                  <span className="spinner-small"></span>
                  <span>Salvando…</span>
                </>
              ) : showSaved ? (
                <>
                  <span>✓</span>
                  <span>Salvo</span>
                </>
              ) : null}
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
          <input
            type="text"
            id="display_name"
            defaultValue={profile.profile?.display_name || ''}
            onChange={(e) => updateProfile({ display_name: e.target.value })}
            placeholder="Como você quer ser chamado?"
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">Username (URL pública)</label>
          <input
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
          <input
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
  const { profile, updateGm, addSystem, removeSystem } = useProfileContext();
  const gmProfile = (profile?.gm || {}) as Partial<GmProfile>;
  const [bannerHasError, setBannerHasError] = useState(false);

  if (!profile) return null;

  // Spec 099 B10: prévia do perfil público — espelha o que o editor TEM AGORA
  // (nada de dado fake). Sem perfil de mestre (profile.gm null) não há o que
  // espelhar: a prévia não monta. display_name segue o COALESCE do GET público
  // (nickname → display_name do usuário → slug), mesmo fallback do backend.
  const previewData = profile.gm
    ? buildMestrePreviewData(profile.gm, profile.profile?.display_name)
    : null;

  return (
    <div className="tab-mestre">
      <section className="form-section">
        <h2>Perfil de Mestre</h2>

        {/* Spec 099 B6: anos de experiência — recomendado, com frase do ganho.
            Componente extraído para GmProfileFields (mesmo markup de antes). */}
        <ExperienceYearsField value={gmProfile.experience_years ?? null} />

        {/* Spec 099 B9 / D4: o campo "Preço Médio" (average_price) saiu do
            editor. Banco e PUT do backend intactos — o preço da mesa
            (MestreFeaturedTable, table.price_value) e o do grupo fechado
            (MestreClosedGroupSection, min_price_cents) continuam. */}

        {/* Spec 099 B6: bio detalhada — recomendado, com frase do ganho.
            Componente extraído para GmProfileFields (mesmo markup de antes). */}
        <BioLongField value={gmProfile.bio_long ?? ''} />

        {/* Spec 099 B1: slogan — encabeça as três cadeias (hero/OG/SEO, §2.3).
            Grava via PUT /gm/profile, uma chamada por campo (padrão da página). */}
        <TaglineField
          value={gmProfile.tagline ?? ''}
          onChange={(tagline) => updateGm({ tagline: tagline || null })}
        />

        {/* Spec 099 B5: faixa promocional — junto do slogan (os dois dividem a
            dobra, §2.1); a exibição já existe no MestreHero (hero-promo-badge). */}
        <PromoBadgeField value={gmProfile.promo_badge_text ?? ''} />

        {/* Spec 099 B3: specialties/languages/badges (string[], TagInput).
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
      </section>

      {/* Spec 099 B10 (D5/D8): prévia do perfil público logo após os campos de
          identidade — o mestre vê o texto real que digitou sobre a foto real
          (aceite B10). O véu do banner é o scrim FIXO do MestreHero real (D8):
          a prévia reusa o componente, não replica nem expõe opacidade. */}
      {previewData && (
        <section className="form-section">
          <MestreProfilePreview profile={previewData} />
        </section>
      )}

      <section className="form-section">
        <h2>Sistemas que Mestra</h2>
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
      </section>

      {/* Spec 099 B2: grupo fechado — os 4 campos + liga/desliga, todos via PUT
          /gm/profile. Chave ausente no patch NÃO entra no updateGm: o
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

      <section className="form-section">
        <LinksManager />
      </section>

      {/* Seção "Conexão Discord" removida da UI em 2026-08-27: a integração foi
          ADIADA (decisão do mantenedor), não cancelada. O backend permanece
          intacto e funcional — `/auth/discord/connect`, `/auth/discord/callback`,
          `DELETE /auth/discord/disconnect` (discord.ts:164, montado em
          server.ts:118) e os campos `discord_connected`/
          `discord_username`/`covil_verified` continuam servidos e exibidos no
          perfil público. Para retomar, basta reintroduzir este bloco: nada foi
          removido do lado do servidor. */}
    </div>
  );
}
