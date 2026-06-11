-- =============================================================================
-- GLOSSÁRIO ARTIFÍCIO RPG v2 — SCHEMA SQL PURO (ON-PREMISE)
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type user_role         as enum ('member', 'admin');
create type term_nucleus      as enum ('oficial', 'sugestao');
create type term_status       as enum ('pendente', 'verificado', 'rejeitado');
create type source_type       as enum ('sistema', 'cenario');
create type category_type     as enum ('sistema', 'cenario');
create type vote_direction    as enum ('up', 'down');
create type update_log_type   as enum ('app', 'dados');

-- =============================================================================
-- TABELA: users (Local)
-- =============================================================================

create table public.users (
  id             uuid        primary key default uuid_generate_v4(),
  full_name      text        not null,
  username       text        unique not null,
  email          text        unique not null,
  password_hash  text        not null,
  role           user_role   not null default 'member',
  avatar_url     text,
  banned         boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Trigger: atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- TABELAS: systems e editions
-- =============================================================================

create table public.systems (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null unique,
  slug        text        not null unique,
  description text,
  created_by  uuid        references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger systems_updated_at before update on public.systems
  for each row execute procedure public.set_updated_at();

create table public.editions (
  id          uuid        primary key default uuid_generate_v4(),
  system_id   uuid        not null references public.systems(id) on delete cascade,
  name        text        not null,
  slug        text        not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (system_id, slug)
);

create trigger editions_updated_at before update on public.editions
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- TABELAS: scenarios e scenario_editions
-- =============================================================================

create table public.scenarios (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null unique,
  slug        text        not null unique,
  description text,
  system_id   uuid        references public.systems(id) on delete set null,
  created_by  uuid        references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger scenarios_updated_at before update on public.scenarios
  for each row execute procedure public.set_updated_at();

create table public.scenario_editions (
  id          uuid        primary key default uuid_generate_v4(),
  scenario_id uuid        not null references public.scenarios(id) on delete cascade,
  name        text        not null,
  slug        text        not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (scenario_id, slug)
);

-- =============================================================================
-- TABELA: categories
-- =============================================================================

create table public.categories (
  id          uuid            primary key default uuid_generate_v4(),
  parent_id   uuid            references public.categories(id) on delete cascade,
  name        text            not null,
  slug        text            not null,
  type        category_type   not null,
  position    integer         not null default 0,
  created_at  timestamptz     not null default now(),
  updated_at  timestamptz     not null default now(),
  unique (parent_id, slug)
);

create index idx_categories_parent_id on public.categories(parent_id);
create index idx_categories_type      on public.categories(type);

create trigger categories_updated_at before update on public.categories
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- TABELA: terms (Entidade Central)
-- =============================================================================

create table public.terms (
  id               uuid          primary key default uuid_generate_v4(),
  name_en          text          not null,
  name_pt          text          not null,
  nucleus          term_nucleus  not null default 'sugestao',
  status           term_status   not null default 'pendente',
  source_type      source_type   not null,
  system_id        uuid          references public.systems(id)   on delete set null,
  edition_id       uuid          references public.editions(id)  on delete set null,
  scenario_id      uuid          references public.scenarios(id) on delete set null,
  scenario_edition_id uuid       references public.scenario_editions(id) on delete set null,
  category_id      uuid          references public.categories(id) on delete set null,
  book_reference   text,
  page_reference   text,
  additional_info  text,
  added_by         uuid          references public.users(id) on delete set null,
  reviewed_by      uuid          references public.users(id) on delete set null,
  reviewed_at      timestamptz,
  vote_score       integer       not null default 0,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),

  constraint official_requires_reference check (
    nucleus = 'sugestao' or (book_reference is not null and page_reference is not null)
  ),
  constraint source_system_needs_system_id check (source_type != 'sistema' or system_id is not null),
  constraint source_cenario_needs_scenario_id check (source_type != 'cenario' or scenario_id is not null)
);

create index idx_terms_status      on public.terms(status);
create index idx_terms_nucleus     on public.terms(nucleus);
create index idx_terms_source_type on public.terms(source_type);
create index idx_terms_category_id on public.terms(category_id);
create index idx_terms_added_by    on public.terms(added_by);
create index idx_terms_name_en_trgm on public.terms using gin (name_en gin_trgm_ops);
create index idx_terms_name_pt_trgm on public.terms using gin (name_pt gin_trgm_ops);

create trigger terms_updated_at before update on public.terms
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- TABELAS SECUNDÁRIAS (Fontes, Votos, Comentários, Logs)
-- =============================================================================

create table public.term_sources (
  id             uuid        primary key default uuid_generate_v4(),
  term_id        uuid        not null references public.terms(id) on delete cascade,
  book_reference text        not null,
  page_reference text        not null,
  notes          text,
  created_at     timestamptz not null default now()
);

create table public.term_votes (
  id         uuid            primary key default uuid_generate_v4(),
  term_id    uuid            not null references public.terms(id) on delete cascade,
  user_id    uuid            not null references public.users(id) on delete cascade,
  direction  vote_direction  not null,
  created_at timestamptz     not null default now(),
  unique (term_id, user_id)
);

create or replace function public.update_vote_score()
returns trigger language plpgsql as $$
begin
  update public.terms
  set vote_score = (
    select coalesce(
      sum(case when direction = 'up' then 1 when direction = 'down' then -1 else 0 end),
      0
    )
    from public.term_votes
    where term_id = coalesce(new.term_id, old.term_id)
  )
  where id = coalesce(new.term_id, old.term_id);
  return coalesce(new, old);
end;
$$;

create trigger term_votes_score_sync
  after insert or update or delete on public.term_votes
  for each row execute procedure public.update_vote_score();

create table public.term_comments (
  id         uuid        primary key default uuid_generate_v4(),
  term_id    uuid        not null references public.terms(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  parent_id  uuid        references public.term_comments(id) on delete cascade,
  body       text        not null check (length(body) between 1 and 2000),
  deleted    boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger term_comments_updated_at before update on public.term_comments
  for each row execute procedure public.set_updated_at();

create table public.update_log (
  id         uuid             primary key default uuid_generate_v4(),
  title      text             not null,
  body       text             not null,
  type       update_log_type  not null,
  published  boolean          not null default false,
  created_by uuid             references public.users(id) on delete set null,
  created_at timestamptz      not null default now(),
  updated_at timestamptz      not null default now()
);

create trigger update_log_updated_at before update on public.update_log
  for each row execute procedure public.set_updated_at();

-- FIM DO SCHEMA: Sem regras de Row Level Security. Segurança administrada na API.
