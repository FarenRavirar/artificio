export interface ActivityActor {
  id: string;
  name: string;
  avatar_url: string | null;
  role?: string | null;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: ActivityActor | null;
  target_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

export interface ActivityFiltersState {
  search: string;
  actions: string[];
  actor_id: string | null;
  target_user_id: string | null;
  date_from: string | null;
  date_to: string | null;
}

export interface ActivityFeedResponse {
  data: ActivityEntry[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
  filters_meta: {
    actors: ActivityActor[];
    target_users: ActivityActor[];
    available_actions: string[];
  };
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFiltersState = {
  search: '',
  actions: [],
  actor_id: null,
  target_user_id: null,
  date_from: null,
  date_to: null,
};

export const DEFAULT_ACTIVITY_FILTERS_META: ActivityFeedResponse['filters_meta'] = {
  actors: [],
  target_users: [],
  available_actions: [],
};
