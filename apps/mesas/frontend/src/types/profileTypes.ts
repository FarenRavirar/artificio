export interface PlayerProfile {
  experience_level: 'iniciante' | 'intermediario' | 'veterano' | null;
  playstyle: {
    combat?: number;
    roleplay?: number;
    exploration?: number;
    strategy?: number;
  } | null;
  preferred_days: string[] | null;
  preferred_time: 'manha' | 'tarde' | 'noite' | null;
  pricing_preference: 'free' | 'paid' | 'both' | null;
}

export interface GmProfile {
  id: string;
  user_id: string;
  slug: string;
  nickname: string | null;
  bio_long: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  languages: string[];
  specialties: string[];
  discord_connected: boolean;
  discord_username: string | null;
  covil_verified: boolean;
  experience_years: number | null;
  average_price: number | null;
  gm_style: {
    narrative?: number;
    tactical?: number;
    sandbox?: number;
    railroad?: number;
  } | null;
  tools: string[] | null;
  game_format: {
    session_length?: string;
    frequency?: string;
    group_size?: string;
  } | null;
  preferred_vtt_platforms?: string[];
  contact_methods?: Array<{
    channel: 'whatsapp' | 'email' | 'discord' | 'form';
    value: string;
    label?: string;
    discord_server_url?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface UserSystem {
  id: string;
  user_id: string;
  system_id: string;
  type: 'favorite' | 'gm';
  created_at: string;
}

export interface FullProfile {
  user: {
    id: string;
    email: string;
    username: string | null;
    location: string | null;
    role: string;
    created_at: string;
  };
  profile: {
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    languages: string[];
  } | null;
  player: PlayerProfile | null;
  gm: GmProfile | null;
  systems: {
    favorite: UserSystem[];
    gm: UserSystem[];
  };
}
