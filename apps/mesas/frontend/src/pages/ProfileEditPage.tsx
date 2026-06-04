import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProfileContext } from '../contexts/useProfileContext';
import type { PlayerProfile, GmProfile } from '../hooks/useProfile';
import { UserSystemsSelector } from '../components/UserSystemsSelector';
import { LinksManager } from '../components/LinksManager';
import { showSuccess, showError } from '../utils/toast';
import { track } from '../services/analytics';
import { useImageUrlImport } from '../hooks/useImageUrlImport';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import './ProfileEditPage.css';

/**
 * Página de edição de perfil com tabs
 * Tabs: Geral | Jogador | Mestre
 * Autosave com debounce 500ms
 */

type TabType = 'geral' | 'jogador' | 'mestre';

const VALID_TABS: TabType[] = ['geral', 'jogador', 'mestre'];

const sanitizeTab = (tab: string | null): TabType => {
  return VALID_TABS.includes(tab as TabType) ? (tab as TabType) : 'geral';
};

export default function ProfileEditPage() {
  const { profile, loading, saving, error, refetch } = useProfileContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = sanitizeTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showSaved, setShowSaved] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const tabFromUrl = sanitizeTab(searchParams.get('tab'));
    setActiveTab((currentTab) => (currentTab === tabFromUrl ? currentTab : tabFromUrl));
  }, [searchParams]);

  // Sincronizar aba com URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    track('profile_tab_changed', { from: activeTab, to: tab });
  };

  // Feedback de autosave com timeout
  useEffect(() => {
    if (!saving && profile) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saving, profile]);

  // Feedback de conexão Discord
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

  // Handler para desconexão Discord
  const handleDisconnectDiscord = useCallback(async () => {
    if (!window.confirm('Deseja desconectar sua conta Discord?')) return;
    
    setDisconnecting(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await authenticatedFetch(`${apiUrl}/auth/discord/disconnect`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        showSuccess('Discord desconectado com sucesso!');
        track('discord_disconnected');
        await refetch();
      } else {
        showError('Erro ao desconectar Discord.');
        track('discord_disconnection_failed');
      }
    } catch (error) {
      console.error('Erro ao desconectar Discord:', error);
      showError('Erro ao desconectar Discord.');
      track('discord_disconnection_failed', { error: String(error) });
    } finally {
      setDisconnecting(false);
    }
  }, [refetch]);

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
            {saving ? (
              <div 
                className="autosave-indicator saving"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="spinner-small"></span>
                <span>Salvando alterações...</span>
              </div>
            ) : showSaved ? (
              <div 
                className="autosave-indicator saved"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <span>✓</span>
                <span>Alterações salvas</span>
              </div>
            ) : null}
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
            <TabMestre 
              onDisconnectDiscord={handleDisconnectDiscord}
              disconnecting={disconnecting}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// TAB GERAL
// =============================================================================

function TabGeral() {
  const { profile, updateUser, updateProfile } = useProfileContext();
  const [avatarError, setAvatarError] = useState(false);
  const [bio, setBio] = useState(profile?.profile?.bio || '');
  const currentAvatar = profile?.profile?.avatar_url || '';

  const handleAvatarChange = (url: string) => {
    setAvatarError(false);
    updateProfile({ avatar_url: url });
  };

  const avatarUrlImport = useImageUrlImport({
    purpose: 'profile_avatar',
    getUrl: () => currentAvatar,
    onImported: handleAvatarChange,
    onError: showError,
    onSuccess: showSuccess,
  });

  if (!profile) return null;

  return (
    <div className="tab-geral">
      <section className="form-section">
        <h2>Informações Básicas</h2>

        <div className="form-group">
          <label>Foto de Perfil</label>
          <p className="field-description">
            Esta é a sua foto de usuário. Ela aparece em comentários, avaliações e no cabeçalho do site.
          </p>
          <div className="avatar-premium-container">
            <div className="avatar-premium-preview">
              {currentAvatar && !avatarError ? (
                <img 
                  src={currentAvatar} 
                  alt="Foto de perfil" 
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="avatar-preview-placeholder">
                  {profile.profile?.display_name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="avatar-premium-actions">
              <div className="avatar-upload-section">
                <input
                  type="file"
                  id="avatar-file-input"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validação de tamanho
                    if (file.size > 5 * 1024 * 1024) {
                      alert('Arquivo muito grande. Limite de 5 MB.');
                      return;
                    }

                    // Validação de tipo
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                      alert('Formato inválido. Envie apenas JPG, PNG ou WEBP.');
                      return;
                    }

                    // Upload via backend
                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                      const apiUrl = import.meta.env.VITE_API_URL || '';
                      const response = await fetch(`${apiUrl}/api/v1/upload`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                      });

                      const payload = await response.json();

                      if (!response.ok || !payload?.secure_url) {
                        throw new Error(payload?.error || 'Falha ao enviar imagem.');
                      }

                      handleAvatarChange(payload.secure_url);
                    } catch (error) {
                      alert(error instanceof Error ? error.message : 'Erro ao fazer upload.');
                    }

                    e.target.value = '';
                  }}
                />
                <div className="avatar-button-row">
                  <button 
                    type="button"
                    className="btn-avatar-action btn-upload"
                    onClick={() => document.getElementById('avatar-file-input')?.click()}
                  >
                    📤 Enviar nova imagem
                  </button>
                  <button 
                    type="button"
                    className="btn-avatar-action btn-google"
                    onClick={async () => {
                      try {
                        const apiUrl = import.meta.env.VITE_API_URL || '';
                        const response = await fetch(`${apiUrl}/api/v1/profile/me/google-picture`, {
                          method: 'POST',
                          credentials: 'include',
                        });

                        const payload = await response.json();

                        if (!response.ok) {
                          throw new Error(payload?.error || 'Erro ao buscar foto do Google.');
                        }

                        handleAvatarChange(payload.data.avatar_url);
                        showSuccess('Foto do Google aplicada com sucesso!');
                      } catch (error) {
                        showError(error instanceof Error ? error.message : 'Erro ao buscar foto do Google.');
                      }
                    }}
                  >
                    🔄 Usar imagem do Google
                  </button>
                </div>
              </div>
              <div className="avatar-button-group">
                {currentAvatar && (
                  <button 
                    type="button"
                    className="btn-avatar-action btn-remove"
                    onClick={() => handleAvatarChange('')}
                  >
                    Remover foto
                  </button>
                )}
                <details className="avatar-manual-details">
                  <summary className="btn-avatar-action btn-manual">
                    🔗 Usar URL manual
                  </summary>
                  <div className="avatar-manual-input">
                    <input
                      type="url"
                      id="avatar_url"
                      value={currentAvatar}
                      onChange={(e) => handleAvatarChange(e.target.value)}
                      onBlur={avatarUrlImport.importUrlIfNeeded}
                      placeholder="https://exemplo.com/avatar.jpg"
                    />
                    <label className="avatar-direct-link-option" title={avatarUrlImport.directLinkTooltip}>
                      <input
                        type="checkbox"
                        checked={avatarUrlImport.keepDirectLink}
                        onChange={(e) => avatarUrlImport.setKeepDirectLink(e.target.checked)}
                      />
                      <span>Manter link direto</span>
                    </label>
                    <small>
                      {avatarUrlImport.isImportingUrl
                        ? 'Importando imagem para a hospedagem do Artifício...'
                        : 'Desativado por padrão: links externos são importados ao sair do campo.'}
                    </small>
                    {avatarError && currentAvatar && (
                      <small className="error-text">❌ Não foi possível carregar a imagem</small>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

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

function TabMestre({ 
  onDisconnectDiscord, 
  disconnecting 
}: { 
  onDisconnectDiscord: () => void;
  disconnecting: boolean;
}) {
  const { profile, updateGm, addSystem, removeSystem } = useProfileContext();
  const [connecting, setConnecting] = useState(false);
  const gmProfile = (profile?.gm || {}) as Partial<GmProfile>;
  const [bioLong, setBioLong] = useState(gmProfile.bio_long || '');

  const gmAvatarUrlImport = useImageUrlImport({
    purpose: 'profile_avatar',
    getUrl: () => gmProfile.avatar_url || '',
    onImported: (url) => updateGm({ avatar_url: url }),
    onError: showError,
    onSuccess: showSuccess,
  });

  if (!profile) return null;

  return (
    <div className="tab-mestre">
      <section className="form-section">
        <h2>Perfil de Mestre</h2>

        <div className="form-group">
          <label htmlFor="experience_years">Anos de Experiência</label>
          <input
            type="number"
            id="experience_years"
            min="0"
            defaultValue={gmProfile.experience_years || ''}
            onChange={(e) => updateGm({ experience_years: parseInt(e.target.value) || null })}
            placeholder="Quantos anos você mestra?"
          />
        </div>

        <div className="form-group">
          <label htmlFor="average_price">Preço Médio (R$)</label>
          <input
            type="number"
            id="average_price"
            min="0"
            step="0.01"
            defaultValue={gmProfile.average_price || ''}
            onChange={(e) => updateGm({ average_price: parseFloat(e.target.value) || null })}
            placeholder="Valor médio por sessão"
          />
        </div>

        <div className="form-group">
          <label>Bio Detalhada</label>
          <MarkdownEditor
            value={bioLong}
            onChange={(text) => { setBioLong(text); updateGm({ bio_long: text }); }}
            placeholder="Conte sobre sua experiência como mestre..."
            height={300}
          />
        </div>

        <div className="form-group">
          <label>Foto de Mestre</label>
          <p className="field-description">
            Esta é a sua foto como mestre. Ela aparece nas suas mesas e no seu perfil público de mestre. Se não definir, será usada a foto de perfil geral.
          </p>
          <div className="avatar-premium-container">
            <div className="avatar-premium-preview">
              {gmProfile.avatar_url ? (
                <img 
                  src={gmProfile.avatar_url} 
                  alt="Foto de mestre" 
                />
              ) : profile.profile?.avatar_url ? (
                <img 
                  src={profile.profile.avatar_url} 
                  alt="Foto de perfil (padrão)" 
                />
              ) : (
                <div className="avatar-preview-placeholder">
                  {profile.profile?.display_name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="avatar-premium-actions">
              <div className="avatar-upload-section">
                <input
                  type="file"
                  id="gm-avatar-file-input"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > 5 * 1024 * 1024) {
                      alert('Arquivo muito grande. Limite de 5 MB.');
                      return;
                    }

                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                      alert('Formato inválido. Envie apenas JPG, PNG ou WEBP.');
                      return;
                    }

                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                      const apiUrl = import.meta.env.VITE_API_URL || '';
                      const response = await fetch(`${apiUrl}/api/v1/upload`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                      });

                      const payload = await response.json();

                      if (!response.ok || !payload?.secure_url) {
                        throw new Error(payload?.error || 'Falha ao enviar imagem.');
                      }

                      updateGm({ avatar_url: payload.secure_url });
                    } catch (error) {
                      alert(error instanceof Error ? error.message : 'Erro ao fazer upload.');
                    }

                    e.target.value = '';
                  }}
                />
                <div className="avatar-button-row">
                  <button 
                    type="button"
                    className="btn-avatar-action btn-upload"
                    onClick={() => document.getElementById('gm-avatar-file-input')?.click()}
                  >
                    📤 Enviar nova imagem
                  </button>
                  <button 
                    type="button"
                    className="btn-avatar-action btn-google"
                    onClick={async () => {
                      try {
                        const apiUrl = import.meta.env.VITE_API_URL || '';
                        const response = await fetch(`${apiUrl}/api/v1/profile/me/google-picture`, {
                          method: 'POST',
                          credentials: 'include',
                        });

                        const payload = await response.json();

                        if (!response.ok) {
                          throw new Error(payload?.error || 'Erro ao buscar foto do Google.');
                        }

                        updateGm({ avatar_url: payload.data.avatar_url });
                        showSuccess('Foto do Google aplicada como foto de mestre!');
                      } catch (error) {
                        showError(error instanceof Error ? error.message : 'Erro ao buscar foto do Google.');
                      }
                    }}
                  >
                    🔄 Usar imagem do Google
                  </button>
                </div>
              </div>
              <div className="avatar-button-group">
                {gmProfile.avatar_url && (
                  <button 
                    type="button"
                    className="btn-avatar-action btn-remove"
                    onClick={() => updateGm({ avatar_url: '' })}
                  >
                    Remover foto de mestre
                  </button>
                )}
                <details className="avatar-manual-details">
                  <summary className="btn-avatar-action btn-manual">
                    🔗 Usar URL manual
                  </summary>
                  <div className="avatar-manual-input">
                    <input
                      type="url"
                      id="gm_avatar_url"
                      value={gmProfile.avatar_url || ''}
                      onChange={(e) => updateGm({ avatar_url: e.target.value })}
                      onBlur={gmAvatarUrlImport.importUrlIfNeeded}
                      placeholder="https://exemplo.com/avatar.jpg"
                    />
                    <label className="avatar-direct-link-option" title={gmAvatarUrlImport.directLinkTooltip}>
                      <input
                        type="checkbox"
                        checked={gmAvatarUrlImport.keepDirectLink}
                        onChange={(e) => gmAvatarUrlImport.setKeepDirectLink(e.target.checked)}
                      />
                      <span>Manter link direto</span>
                    </label>
                    <small>
                      {gmAvatarUrlImport.isImportingUrl
                        ? 'Importando imagem para a hospedagem do Artifício...'
                        : 'Desativado por padrão: links externos são importados ao sair do campo.'}
                    </small>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      <section className="form-section">
        <LinksManager />
      </section>

      {/* Seção Discord */}
      <section className="form-section">
        <h2>Conexão Discord</h2>
        <p className="section-description">
          Conecte sua conta Discord para verificação e badges especiais
        </p>
        
        {profile?.gm?.discord_connected ? (
          <div className="discord-connected">
            <p>✅ Discord conectado</p>
            <p className="discord-username">
              🟣 {profile.gm.discord_username}
            </p>
            {profile.gm.covil_verified && (
              <div className="covil-badge">
                🏰 Membro Verificado do Covil
              </div>
            )}
            <button
              onClick={onDisconnectDiscord}
              className="btn-disconnect-discord"
              disabled={disconnecting} // CORREÇÃO P14: Desabilitar durante loading
            >
              {disconnecting ? '⏳ Desconectando...' : 'Desconectar Discord'}
            </button>
          </div>
        ) : (
          <div className="discord-disconnected">
            <p>Conecte sua conta Discord para:</p>
            <ul>
              <li>Verificar membro do servidor Covil</li>
              <li>Exibir badge no perfil público</li>
              <li>Futuras integrações comunitárias</li>
            </ul>
            <button
              onClick={async () => {
                setConnecting(true);
                try {
                  const apiUrl = import.meta.env.VITE_API_URL || '';
                  const response = await authenticatedFetch(`${apiUrl}/auth/discord/connect`);
                  
                  if (response.redirected) {
                    // Backend retornou redirect para Discord OAuth
                    window.location.href = response.url;
                  } else if (!response.ok) {
                    const data = await response.json();
                    showError(data.error || 'Erro ao conectar Discord');
                    setConnecting(false);
                  }
                } catch (error) {
                  console.error('Erro ao conectar Discord:', error);
                  showError('Erro ao conectar Discord');
                  setConnecting(false);
                }
              }}
              className="btn-connect-discord"
              disabled={connecting}
            >
              {connecting ? '⏳ Conectando...' : '🟣 Conectar Discord'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
