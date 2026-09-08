# MANIFEST — Backup G1 · 2026-06-04

Destino: `C:\projetos\artificiobackup\2026-06-04\` (off-VM, off-git). Origem: VM `faren` `/tmp/artificio-backup-2026-06-04/`. Total local: 69.591.772 bytes (~66MB).

| Arquivo | Bytes | SHA-256 |
|---|---|---|
| postgres/glossario_beta.dump | 534186 | 37996b902987888f5ea68146961da6694449342db4a0f9521523a5caadb25c92 |
| postgres/glossario_prod.dump | 542000 | e00db901de5d71be087461e0dec54ef8728e3697a1c5f713b49d4e991abca91d |
| postgres/mesas_beta.dump | 629085 | 398a3ab52e17bee469eb5365e9874b7fa3b153121fc48c4712f0d616778f9426 |
| postgres/mesas_prod.dump | 292516 | 6dd9304bfd00e248a0be277efbc2346bb8b5173d982e19bd4b65bf45efc5ac34 |
| volumes/glossario-beta_pgdata_beta.tar.gz | 15723422 | 4d62cffd51658382a2b04dacf75ca62d25e19caa16f3b62502cb486c6cae6e02 |
| volumes/glossario_pgdata_prod.tar.gz | 18987869 | 8dd3e3f01f8692e0070c635b51e219657a054592f487553fb5d77c23e7e4a48c |
| volumes/glossario_pgdata_producao.tar.gz | 6921709 | 9ffb434342d43335ddb6f798bbdf8fee42ba400f5de994e259f43bbf4db1e7cc |
| volumes/mesas-beta_pgdata_mesas_beta.tar.gz | 15114201 | 8b948d150111d8930af620010d85e342560fc5f4f04d4c1fe60349361097c0fd |
| volumes/mesas_pgdata_mesas_prod.tar.gz | 10844343 | c8f5ee756656940f1fb584ffab5e8fde65a759ded10ff47d477f8c7d33433284 |
| secrets.7z (5 arq: 4 `.env` serviço + `wp-hostinger.env`) | 1439 | a721577b9e0cbcbc59481322449a64778cfd275f709ae33a744025804b36fb83 |

Senha do `secrets.7z`: `C:\projetos\artificiobackup\secrets-7z-password.txt` (off-git, local). **Rotacionar creds + mover senha p/ cofre pós-migração.**

## Verificação
- `sha256sum -c` no destino: todos OK.
- Restore-test `glossario_prod.dump` em container scratch: 14 tabelas (`audit_log, categories, editions, scenario_editions, scenarios, systems, term_comments, term_history, term_sources, term_votes, terms, update_log, user_notifications, users`).

## Fora de escopo (confirmado)
WP (Hostinger cloud, D024) · gerenciador_telegram + foundry (D021) · uploads (on-demand Fase 3, D025).
