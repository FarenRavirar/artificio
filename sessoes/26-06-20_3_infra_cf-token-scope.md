# Sessão 26-06-20_3 — Investigação: Token CF sem escopo de tunnel (403)

- **Data:** 2026-06-20
- **Escopo:** infra/Cloudflare — API token, tunnel management
- **Gate:** N/A (diagnóstico read-only)
- **Autorização:** mantenedor pediu investigar e registrar débitos reais. Só read‑only.

## T0/T1 lidos

T0: `project-state.md`, `context-capsule.md`, `decisions.md`. T1: `infra-map.md`, `access-registry.md`, `backlog.md`, `errors.md`, `AGENTS.md` (Acesso à VM, Banco/Infra/Segredos).

## Diagnóstico

### Testes executados (read-only, local, PowerShell)

| Endpoint | Resultado |
|---|---|
| `accounts/{id}/tokens/verify` | ✅ 200 (token válido, account‑scoped) |
| `zones?name=artificiorpg.com` | ✅ 200 (zone read OK) |
| `zones/{id}/dns_records` | ✅ 200 (29 registros) |
| `zones/{id}/settings/ssl` | ✅ 200 (settings read OK) |
| `accounts/{id}/cfd_tunnel` | ❌ 403 Forbidden |
| `accounts/{id}/cfd_tunnel?is_deleted=false` | ❌ 403 Forbidden |
| `accounts/{id}/memberships` | ❌ 403 Forbidden |
| `accounts/{id}/access/apps` | ❌ 403 Forbidden |

### Causa raiz

O token API (`CLOUDFLARE_API_TOKEN`, `cfat_…`) foi criado em 2026-06-18 com permissões:
- `Zone:Read` ✅
- `DNS:Read` ✅  
- `Cache:Purge` ✅
- **`Cloudflare Tunnel:Read` ❌** (ausente)
- **`Cloudflare Tunnel:Edit` ❌** (ausente)

### Estado documental

- `access-registry.md` L11: "Escopo atual NÃO cobre Account‑level (tunnel/logs read = 'Authentication error')"
- `access-registry.md` L56: "tunnel/logs read exigem escopo Account‑level — confirmar no token rotado se/quando for usar túnel/logs"
- `context-capsule.md` L49: "tunnel/logs read pendente de escopo do token"

**Conclusão:** A limitação era conhecida e documentada, mas nunca virou tarefa acionável no backlog. O mantenedor acreditava que o token já cobria tunnel management.

## Aprendizados reais → débitos

### 1. Gap de escopo do token (raiz)

O token `CLOUDFLARE_API_TOKEN` precisa das permissões `Cloudflare Tunnel:Read` + `Cloudflare Tunnel:Edit` para que agentes possam gerenciar túneis (listar, criar, editar hostnames públicos, diagnosticar). Sem isso, toda operação de tunnel exige intervenção manual do mantenedor no dashboard.

### 2. Documentação "pendente" sem backlog = dívida invisível

`access-registry.md` e `context-capsule.md` documentaram "tunnel/logs read pendente" como nota, mas não abriram item no `specs/backlog.md`. Notas documentais sem item acionável viram débito esquecido.

### 3. Distinção TUNNEL_TOKEN vs API_TOKEN

- `TUNNEL_TOKEN` (container `cloudflared`, em `/opt/artificio/cloudflared/.env`): autentica o daemon tunnel → Cloudflare edge. **Funciona** (tráfego passa).
- `CLOUDFLARE_API_TOKEN` (env Windows, `cfat_…`): usada por agentes para gerenciar recursos Cloudflare via API REST. **Nunca teve escopo de tunnel.**

São tokens distintos com propósitos distintos. O primeiro estar funcional não implica o segundo conseguir gerenciar túneis.

### 4. Escopo mínimo de tunnel para agentes

Para o que o mantenedor espera (gerenciar e criar túneis), o token precisa de:
- `Account:Cloudflare Tunnel:Read` — listar túneis, ver configurações, ler hostnames
- `Account:Cloudflare Tunnel:Edit` — criar/editar/deletar túneis, gerenciar hostnames públicos (DNS do tunnel)

## Checklist de fechamento

- [x] T0 lido
- [x] Diagnóstico read-only executado (6 endpoints testados)
- [x] Causa raiz identificada (token sem permissão Account:CF Tunnel)
- [x] Débitos registrados no `specs/backlog.md` (BL-CF-TUNNEL-TOKEN-SCOPE)
- [x] `access-registry.md` atualizado com achado confirmado
- [ ] Mantenedor precisa adicionar permissões no Cloudflare Dashboard → API Tokens

## Próximo passo

Ação do **mantenedor** (não pode ser feita pelo agente, pois envolve dashboard Cloudflare com credenciais de conta):
1. Cloudflare Dashboard → **Manage Account** → **API Tokens**
2. Localizar o token `cfat_…` usado no `CLOUDFLARE_API_TOKEN`
3. Editar permissões → adicionar:
   - `Account` → `Cloudflare Tunnel` → `Read`
   - `Account` → `Cloudflare Tunnel` → `Edit`
4. (Opcional) Se criar token novo, atualizar `CLOUDFLARE_API_TOKEN` via `setx` no Windows e reiniciar terminal.

Depois disso, validar: `GET /accounts/{id}/cfd_tunnel` deve retornar 200 com a lista de túneis.
