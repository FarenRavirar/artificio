import { createContext } from 'react';
import type { CropRect } from '@artificio/media/image-kinds';
import type { FullProfile, GmProfile, PlayerProfile } from '../types/profileTypes';

export interface ProfileContextValue {
  profile: FullProfile | undefined;
  loading: boolean;
  error: string | null;
  saving: boolean;
  /**
   * Erro da última tentativa de gravação (autosave). `null` quando a última
   * gravação foi bem-sucedida. Alimenta o indicador `.autosave-indicator` da
   * página de edição (estado `error`) — spec 099 B8.
   */
  saveError: string | null;
  refetch: () => void;
  updateUser: (data: { username?: string; location?: string }) => Promise<void>;
  updateProfile: (data: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    avatar_crop_data?: CropRect | null;
    avatar_width?: number | null;
    avatar_height?: number | null;
    languages?: string[];
  }) => Promise<void>;
  updatePlayer: (data: Partial<PlayerProfile>) => Promise<void>;
  updateGm: (data: Partial<GmProfile>) => Promise<void>;
  /**
   * Descarrega AGORA o autosave pendente do perfil de mestre e espera a
   * gravação terminar (spec 099, fase G — G4).
   *
   * Existe por causa da porta para o link oficial: a aba nova busca do servidor
   * como qualquer visitante, então abrir com o debounce de 500ms ainda contando
   * mostraria a versão anterior — o mestre escreveria, abriria, não veria a
   * mudança e concluiria que quebrou. O botão cancela a espera, grava e só
   * então abre.
   *
   * Devolve `true` quando não há nada pendente ou a gravação foi bem-sucedida,
   * e `false` quando ela falhou — nesse caso quem chamou NÃO deve abrir a aba:
   * levar o mestre a uma página que não tem o que ele acabou de escrever é
   * exatamente o engano que este flush existe para evitar.
   */
  flushGm: () => Promise<boolean>;
  addSystem: (systemId: string, type?: 'favorite' | 'gm') => Promise<void>;
  removeSystem: (systemId: string) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);
