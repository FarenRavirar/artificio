# Plano — 013

## Arquitetura da solução
1. **Localizar artefato (T1, bloqueante):** perguntar caminho ao mantenedor; varrer `C:\projetos` e `C:\projetos\artificiobackup` (inclusive dentro de `secrets.7z` e `opt-dirs/*.tar.gz`); checar Cloudflare (Pages/Workers + DNS records dos 2 hostnames) read-only; Hostinger se mantenedor indicar.
2. **`apps/links`:** app estática (HTML/TS buildado por Vite se a página original era TS) servida por nginx; um container, dois `server_name` (links + regras) ou roteamento por host no mesmo estático.
3. **Deploy:** `deploy-links.yml` via `_deploy-module.yml` (sem DB/migrations — passos no-op graciosos, padrão site).
4. **Tunnel:** 2 rotas hostname→`links-app`.

## Arquivos afetados
- `apps/links/**` (novo) · `.github/workflows/deploy-links.yml` (novo)
- VM: ingress tunnel (2 hostnames) — aprovação
- `decisions.md` (fechar D027), `roadmap.md`

## Contratos/interfaces tocados
DNS/tunnel (2 hostnames). Nenhum auth/schema.

## Impacto em consumidores
Spec 014 (nav WhatsApp) depende do `links.` no ar. Nenhum outro.

## Rollback
Remover rotas do tunnel; container fora não afeta nada (páginas estavam fora do ar — estado atual É o estado de falha).

## Validação
`curl -s` 200 nos 2 hostnames; diff visual vs backup/Wayback; mantenedor confirma paridade; deploy Actions verde.
