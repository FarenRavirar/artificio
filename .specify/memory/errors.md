# Erros Conhecidos — Artifício RPG

> Registro de erros/regressões e suas soluções validadas. Antes de tentar de novo, procure aqui por `E###` ou pelo sintoma. Ao resolver algo novo e não trivial, registre.

## Formato

```
### E001 — <título curto do sintoma>
- **Módulo/Pacote:** apps/srd | packages/auth | accounts (SSO) | infra/cloudflare | ...
- **Sintoma:** o que se observa.
- **Causa raiz:** diagnóstico validado.
- **Solução:** passos que resolveram (com evidência).
- **Prevenção:** como evitar de novo.
- **Data:** AAAA-MM-DD
```

## Registros

### E001 — serviço não sobe após restore (frontend `dist` ausente)
- **Módulo/Pacote:** infra · glossário (e qualquer serviço que sirva `dist` pré-buildado)
- **Sintoma:** após restaurar deploy dirs do backup, `docker compose up` falha/serve vazio porque `dist/` não existe.
- **Causa raiz:** backup dos `opt-dirs` excluiu `dist` (`--exclude=dist`); o serviço servia build pré-gerado, não buildava no deploy.
- **Solução:** rebuildar `dist` antes do up (ex.: `docker run --rm -v $PWD:/app -w /app node:20-alpine sh -c 'npm ci && npm run build'`), depois `docker compose up -d`.
- **Prevenção:** no redeploy, se o serviço serve `dist` pré-buildado, buildar primeiro; ou garantir que o compose tenha etapa de build.
- **Data:** 2026-06-04
