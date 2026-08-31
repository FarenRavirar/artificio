import { createContext } from 'react';
import type { CropRect } from '@artificio/media/image-kinds';
import type { FullProfile, GmProfile, PlayerProfile } from '../types/profileTypes';

export interface ProfileContextValue {
  profile: FullProfile | undefined;
  loading: boolean;
  error: string | null;
  saving: boolean;
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
  addSystem: (systemId: string, type?: 'favorite' | 'gm') => Promise<void>;
  removeSystem: (systemId: string) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);
