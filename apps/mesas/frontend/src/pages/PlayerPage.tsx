import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Clock, DollarSign, Gamepad2, Star } from 'lucide-react';
import { applySeo } from '../utils/seo';
import './PlayerPage.css';

interface PlayerProfilePayload {
  data: {
    user: {
      username: string;
      display_name: string;
      location: string | null;
      created_at: string;
    };
    profile: {
      bio: string | null;
      avatar_url: string | null;
    } | null;
    player: {
      experience_level: 'iniciante' | 'intermediario' | 'veterano' | null;
      preferred_time: 'manha' | 'tarde' | 'noite' | 'qualquer' | null;
      price_preference: 'gratuita' | 'paga' | 'ambas' | null;
      playstyle_combat: number | null;
      playstyle_roleplay: number | null;
      playstyle_exploration: number | null;
      playstyle_strategy: number | null;
    } | null;
    systems: {
      favorite: Array<{
        id: string;
        system_id: string;
        system_name: string;
      }>;
    };
  };
}

const EXPERIENCE_LABELS = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  veterano: 'Veterano',
};

const TIME_LABELS = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  qualquer: 'Qualquer horário',
};

const PRICE_LABELS = {
  gratuita: 'Prefere mesas gratuitas',
  paga: 'Prefere mesas pagas',
  ambas: 'Aceita ambas',
};

export const PlayerPage = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PlayerProfilePayload['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadProfile = async () => {
      if (!username) {
        setError('Perfil inválido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/profile/${username}`, { signal: controller.signal });

        if (res.status === 404) {
          setError('Jogador não encontrado.');
          setProfile(null);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as PlayerProfilePayload;
        setProfile(json.data ?? null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Não foi possível carregar o perfil do jogador.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
    return () => controller.abort();
  }, [username]);

  useEffect(() => {
    applySeo(
      profile ? `${profile.user.display_name} | Jogador | Artifício Mesas` : 'Jogador | Artifício Mesas',
      profile?.profile?.bio?.slice(0, 150) || 'Perfil de jogador na comunidade Artifício RPG.'
    );
  }, [profile]);

  if (loading) {
    return (
      <main className="player-page">
        <div className="container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Carregando perfil...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="player-page">
        <div className="container">
          <div className="error-state">
            <h1>Perfil indisponível</h1>
            <p>{error ?? 'Não foi possível carregar este perfil.'}</p>
            <Link to="/catalogo" className="btn-back">
              Voltar ao catálogo
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const player = (profile.player || {}) as Partial<NonNullable<PlayerProfilePayload['data']['player']>>;
  const hasPlaystyle = player.playstyle_combat !== null || player.playstyle_roleplay !== null;

  return (
    <main className="player-page">
      {/* Header */}
      <section className="player-header">
        <div className="container">
          <div className="player-header-content">
            <div className="player-avatar">
              {profile.profile?.avatar_url ? (
                <img src={profile.profile.avatar_url} alt={profile.user.display_name} />
              ) : (
                <div className="player-avatar-placeholder">
                  {profile.user.display_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="player-info">
              <div className="player-badge">
                <User className="w-4 h-4" /> Jogador
              </div>
              <h1 className="player-name">{profile.user.display_name}</h1>
              <p className="player-username">@{profile.user.username}</p>
              
              {profile.profile?.bio && (
                <p className="player-bio">{profile.profile.bio}</p>
              )}

              {profile.user.location && (
                <p className="player-location">📍 {profile.user.location}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Interesses */}
      {player.experience_level && (
        <section className="player-section">
          <div className="container">
            <h2 className="section-title">🎯 Perfil de Jogador</h2>
            
            <div className="info-grid">
              {player.experience_level && (
                <div className="info-card">
                  <Star className="info-icon" />
                  <h3>Experiência</h3>
                  <p>{EXPERIENCE_LABELS[player.experience_level]}</p>
                </div>
              )}

              {player.preferred_time && (
                <div className="info-card">
                  <Clock className="info-icon" />
                  <h3>Horário Preferido</h3>
                  <p>{TIME_LABELS[player.preferred_time]}</p>
                </div>
              )}

              {player.price_preference && (
                <div className="info-card">
                  <DollarSign className="info-icon" />
                  <h3>Preferência de Preço</h3>
                  <p>{PRICE_LABELS[player.price_preference]}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Estilo de Jogo */}
      {hasPlaystyle && (
        <section className="player-section">
          <div className="container">
            <h2 className="section-title">⚔️ Estilo de Jogo</h2>
            
            <div className="playstyle-bars">
              {player.playstyle_combat !== null && (
                <div className="playstyle-item">
                  <div className="playstyle-label">
                    <span>Combate</span>
                    <span className="playstyle-value">{player.playstyle_combat}/5</span>
                  </div>
                  <div className="playstyle-bar">
                    <div 
                      className="playstyle-fill" 
                      style={{ width: `${((player.playstyle_combat ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {player.playstyle_roleplay !== null && (
                <div className="playstyle-item">
                  <div className="playstyle-label">
                    <span>Socialização</span>
                    <span className="playstyle-value">{player.playstyle_roleplay}/5</span>
                  </div>
                  <div className="playstyle-bar">
                    <div 
                      className="playstyle-fill" 
                      style={{ width: `${((player.playstyle_roleplay ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {player.playstyle_exploration !== null && (
                <div className="playstyle-item">
                  <div className="playstyle-label">
                    <span>Exploração</span>
                    <span className="playstyle-value">{player.playstyle_exploration}/5</span>
                  </div>
                  <div className="playstyle-bar">
                    <div 
                      className="playstyle-fill" 
                      style={{ width: `${((player.playstyle_exploration ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {player.playstyle_strategy !== null && (
                <div className="playstyle-item">
                  <div className="playstyle-label">
                    <span>Estratégia</span>
                    <span className="playstyle-value">{player.playstyle_strategy}/5</span>
                  </div>
                  <div className="playstyle-bar">
                    <div 
                      className="playstyle-fill" 
                      style={{ width: `${((player.playstyle_strategy ?? 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Sistemas Favoritos */}
      {profile.systems.favorite.length > 0 && (
        <section className="player-section">
          <div className="container">
            <h2 className="section-title">🎲 Sistemas Favoritos</h2>
            
            <div className="systems-list">
              {profile.systems.favorite.map((system) => (
                <div key={system.id} className="system-tag">
                  <Gamepad2 className="w-4 h-4" />
                  {system.system_name}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Nota: SEM CTA - perfil informativo apenas */}
    </main>
  );
};
