---
name: add-module
description: Playbook para plugar um novo módulo no monorepo Artifício RPG seguindo o contrato de módulo (próprio subdomínio, SSO compartilhado via accounts., design system, analytics, sitemap, deploy). Use quando for criar um app novo em apps/* ou integrar um serviço existente como módulo G1.
---

# Adicionar um módulo ao G1

Um módulo é um app no **próprio subdomínio** `*.artificiorpg.com` (D017), root `/` próprio, sem basename. Independente mas obedece ao **contrato de módulo**. Sempre SDD Completo (toca infra/SSO/compartilhado).

## 1. Spec primeiro
Criar `specs/NNN-<modulo>-bootstrap/` com `spec.md`, `plan.md`, `tasks.md`. Definir: subdomínio, se exige auth, modelo de dados, fonte de conteúdo, critérios de aceite.

## 2. Estrutura
```
apps/<modulo>/
  package.json                 # @artificio/<modulo>, stack canônica
  vite.config.ts               # base: '/'  (root próprio, sem basename)
  src/
  Dockerfile
  docker-compose.beta.yml      # um compose por ambiente, dentro do app
  docker-compose.prod.yml
  module.manifest.ts           # o contrato (ver §3)
```

## 3. module.manifest.ts (o contrato)
```ts
export const manifest = {
  host: '<sub>.artificiorpg.com',  // subdomínio do módulo
  navLabel: 'Nome no menu',
  navIcon: 'lucide-icon-name',
  requiresAuth: false,             // true se precisa de sessão SSO
  analyticsNamespace: '<sub>',     // stream/dimension GA4
  sitemapProvider: true,           // serve /sitemap.xml próprio
}
```

Hoje só `apps/mesas/module.manifest.ts` existe — é o modelo a copiar.

## 4. Registrar no nav cross-app
Adicionar entrada em `packages/ui/src/modules.ts` (`defaultNavItems`) — **fonte única da nav, não per-app**:
```ts
{ label: 'Novo Módulo', href: 'https://novo.artificiorpg.com' }
```
O `navLabel`/`navIcon` do manifesto descrevem o módulo; a nav compartilhada é montada aqui.

## 5. Conectar compartilhados (packages/*)
- `@artificio/auth` — consumir a sessão SSO. Login redireciona p/ `accounts.artificiorpg.com/login?return=<url>`; valida JWT do cookie `.artificiorpg.com`. Nunca implementar login próprio.
- `@artificio/ui` — Header/Nav/Footer e design tokens. Nav = URLs absolutas pros outros subdomínios. Não divergir do design system.
- `@artificio/analytics` — instrumentar com `track()` e o `analyticsNamespace`. GA4 com `cookie_domain` raiz (D020).
- `@artificio/config` — tsconfig/eslint/env schema compartilhados. **Host/credencial só via env**, nunca hardcoded.
- `@artificio/content` — helpers de SEO (meta, canonical, JSON-LD, sitemap) se o módulo tem conteúdo público.

## 6. Rede / DNS (subdomínio)
- Adicionar regra de ingress no **Cloudflare Tunnel**: `hostname: <sub>.artificiorpg.com → service: http://<container>:<porta>`. Um só `cloudflared`; cert wildcard `*.artificiorpg.com` cobre.
- DNS: registro CNAME do subdomínio apontando ao tunnel (proxied).
- Nada de porta exposta no firewall.
- **DNS/tunnel de produção exige aprovação nominal do mantenedor** (AGENTS.md §Autorização).

## 7. Deploy — entrar no manifesto
O deploy é **declarativo**: `deploy.yml` lê `.github/deploy-manifest.json` e chama `_deploy-module.yml` por módulo. Não existe workflow por app.

- Acrescentar o bloco do módulo em `.github/deploy-manifest.json` (campos como em `mesas`): `module`, `compose_file`, `compose_file_beta`, `compose_project`, `compose_project_beta`, `db_service`, `db_service_beta`, `db_name`, `db_user`, `auto_deploy_on_push`.
- Compose por ambiente em `apps/<modulo>/docker-compose.<env>.yml` (rede externa compartilhada).
- **Imagem buildada na VM, não GHCR.** Turborepo builda só este módulo (affected graph).
- `deploy.yml` só dispara se os `deploy_paths` do manifesto mudarem — doc e spec não deployam.
- Smoke próprio (health no subdomínio).

**Antes de tocar em `Dockerfile`, `migration_*.sql`, lockfile ou workflow: ler a seção correspondente de `docs/agents/deploy-flow.md`** (o hook `deploy-contract-gate` cobra isso).

## 8. Checklist de aceite (Gate D do módulo)
- [ ] `https://<sub>.artificiorpg.com` responde (health + home).
- [ ] Login SSO funciona (se requiresAuth): redirect p/ accounts., volta logado, sessão válida nos outros módulos (cookie raiz).
- [ ] Nav unificada lista o módulo; visual consistente com `packages/ui`.
- [ ] GA4 registra page_view no namespace (cross-subdomínio ok).
- [ ] `/sitemap.xml` + `/robots.txt` servidos; SEO básico ok (rodar `seo-usability-auditor`). Search Console = Domain property cobre o subdomínio.
- [ ] Módulo no `deploy-manifest.json`, com compose beta e prod.
- [ ] Smoke verde em beta.
- [ ] Nenhum host/credencial hardcoded (tudo env).
- [ ] `project-state.md` atualizado.
