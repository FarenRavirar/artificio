# DiscordChatExporter — Solução completa (057)

> Pedido do mantenedor: parar de refazer. Solução completa, para usuário final leigo, sem gambiarra, explicativa, definida, organizada. Tudo via frontend + persistência; nada de escrever na VM à mão.

## 0. Como funciona (modelo mental)

DiscordChatExporter (Tyrrrz, open-source) tem **GUI** e **CLI**. Usamos a **CLI** (`export -c <canal> -f Json`) que gera um JSON do histórico do canal. Nosso backend já tem o **adapter** que lê esse JSON e cria rascunhos de mesa. Duas peças:
1. **Exportar** (CLI roda no servidor → JSON na pasta `importDir/incoming/`).
2. **Importar** (nosso `processDiscordChatExporterFolder` lê a pasta → drafts). Já existe e funciona.

A peça que **não funciona hoje**: a CLI **não está instalada no container** `mesas-api`. O código faz `spawn('DiscordChatExporter.Cli', ...)` (`chatExporterCliRunner.ts:62`) → `ENOENT`. Resolver isso é o coração desta solução.

## 1. Token: qual usar (decisão de segurança)

- **Bot token** é o caminho recomendado (único sem gambiarra). Automatizar **conta de usuário** (user token) **viola o ToS do Discord e pode banir** (doc oficial). Por isso o fluxo da UI deve exibir aviso explícito de risco/ToS ao selecionar modo `user`, mas o modo é **suportado** quando necessário.
- User/session e bot são suportados, **um modo por perfil**. O CLI autentica com `-t token` (user token ou bot token); não existe flag `--cookies` — o campo antigo "Cookies" era nomenclatura errada.
- Requisito do bot: estar **no servidor** + permissões **Ver Canais** + **Ver Histórico de Mensagens** nos canais a exportar.
- Recorte nativo confiável da CLI: `--after`/`--before` para data/hora. `-p 100` é partição do arquivo, não "últimas 100 mensagens"; não usar esse texto na UI como limite de importação.

### Guia do leigo (passo a passo que a UI mostra)
1. Abrir https://discord.com/developers/applications → **New Application**.
2. Aba **Bot** → **Add Bot** → **Reset Token** → copiar o token.
3. Ligar **Message Content Intent** (aba Bot).
4. Aba **OAuth2 → URL Generator** → escopo `bot` + permissões **View Channels** + **Read Message History** → abrir a URL → adicionar ao servidor.
5. Colar o token no painel (campo único). O painel valida sozinho (lista os servidores) → ✓ verde.

Com o token válido, a UI **descobre servidores e canais** (`GET /discovery/guilds[/:id/channels]` — já existe) → o leigo **escolhe num dropdown**, não digita ID cru.

## 2. Rodar a CLI na VM — opções

### Fato decisivo (verificado na VM beta, read-only 2026-06-30)
- `mesas-api` e `mesas-cron` rodam em **container Alpine Linux (musl)**, **sem `dotnet`**, sem `/opt`. Mounts do api = só `logs` (bind) e `frontend-dist` (volume ro).
- **Por isso "instalar na VM" do jeito direto não resolve:** (a) o backend roda **no container**, não no host → instalar no host não fica visível dentro; (b) o DiscordChatExporter é **.NET/glibc** → mesmo bind-mountando um binário instalado no host Ubuntu (glibc), ele **não executa em Alpine (musl)**; (c) instalação manual via `ssh` **some no próximo rebuild/redeploy** e se a VM for recriada (Gate A) — é o "cansei de refazer".
- **Conclusão:** instalar **sim**, mas **reprodutível** (no build/compose, versão pinada), **onde o container alcança**. Duas vias:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **A. Bundle no image** | Dockerfile `mesas-api`(+cron): `apk add dotnet8-runtime icu` + DCE CLI pinada → `DISCORD_CHAT_EXPORTER_BIN=/opt/dce/...`. `spawn` in-process. | "Importar agora" do frontend funciona direto; zero docker socket; tudo num lugar | Engorda a image Alpine (~+120MB com runtime .NET) |
| **B. Container DCE dedicado** | Serviço compose novo `mesas-dce` com a **image oficial `tyrrrz/discordchatexporter:x.y.z`** + volume compartilhado de saída. Agenda = cron dispara o serviço; "Importar agora" = backend dispara o serviço. | Image da api fica magra; runtime .NET isolado; image oficial mantida/pinada | Disparar one-shot exige orquestração (socket docker **ou** wrapper HTTP mínimo) |
| ~~C. docker run via socket na api~~ | montar `docker.sock` no api | — | socket docker no container = risco de segurança → **rejeitada** |
| ~~D. instalar no host à mão~~ | `ssh` + apt | — | não visível no container + some no rebuild/recriação → **rejeitada** |

**DECIDIDO (mantenedor, 2026-06-30): Opção A — bundle no image** (tamanho não é problema; quer a melhor solução = menos peças móveis, run-now in-process, zero socket docker).

### A — variante robusta (sem gambiarra com Alpine/musl)
Multi-stage no Dockerfile do `mesas-api` (e base do `mesas-cron`):
1. **Stage build** (sdk .NET): `git clone` DCE na tag pinada → `dotnet publish DiscordChatExporter.Cli -c Release -r linux-musl-x64 --self-contained true -o /dce`. Self-contained = leva o próprio runtime → **roda em Alpine sem `apk add dotnet`**, sem mismatch musl/glibc.
2. **Stage final** (api Alpine atual): `apk add --no-cache icu-libs libstdc++` (deps nativas do .NET) → `COPY --from=build /dce /opt/dce` → `ENV DISCORD_CHAT_EXPORTER_BIN=/opt/dce/DiscordChatExporter.Cli` → `chmod +x`.
3. Pinning por **tag de versão** do DCE (ex.: `2.44`), nunca `master`/`latest`.
- Fallback se o self-contained musl der problema: `apk add dotnet8-runtime icu` + publish framework-dependent. Mas o self-contained é o caminho preferido (autocontido, reprodutível, imune a drift de runtime do Alpine).
- Reprodutível: vive no Dockerfile versionado → sobrevive a redeploy e recriação da VM (Gate A). Reuso pelo `mesas-cron` para a agenda (§4).

## 3. Persistência + perfis multi-canal (R13)

Tabela nova `discord_chat_exporter_profiles` (migração aditiva, online-safe):
```
id (uuid) · label (text) · guild_id (text) · channel_id (text) · format ('Json')
token_enc (text) · -- bot token por perfil (ou 1 token compartilhado — ver nota)
include_threads ('none'|'active'|'all' default 'active')
after (date null) · media (bool default false)
schedule_enabled (bool) · frequency ('hourly'|'daily'|'weekly') · time (HH:MM) · timezone
import_dir (text) · enabled (bool) · created_at · updated_at · last_run_at · last_status
```
- Token: **compartilhado por padrão** (1 bot serve N canais do mesmo servidor) — guardar 1 token em `discord_settings` e perfis referenciam; permitir **token por perfil** (campo opcional) para servidores diferentes. Encriptado (`settingsCrypto`, já existe).
- `import_dir`: default derivado do servidor (`/data/chat-exporter/<profileId>/`), criado pelo backend (`mkdir -p`). O leigo **não digita path** — gerado.
- Tudo CRUD via frontend; nada escrito à mão na VM.

## 4. Agendamento (sem cron de host editado à mão)

- **Importar agora** (botão) → `POST /run` por perfil (Opção 1, in-process).
- **Agenda** → o container `mesas-cron` (já existe) roda um job que lê os perfis `schedule_enabled` e dispara o export+import na frequência/hora/timezone. A agenda é **dado no DB editável no frontend**, não crontab na VM. (Alinha com spec 052 Bloco A — não duplicar: 052 já planeja ingestão agendada; esta spec entrega a **config/UI**, a 052 entrega o **runner agendado**. Coordenar.)

## 5. UI — wizard leigo (Cloudflare-style)

Bot de Discord › **Configuração** vira um fluxo guiado, não um formulário cru:
1. **Conectar** — campo "Token do bot" + botão Validar (→ `discoverGuilds`). Verde "Conectado a N servidores" ou erro explicativo ("Token inválido" / "Bot sem permissão"). Link "Como obter o token?" abre o guia §1.
2. **Canais** — lista de perfis (`<AdminTable>` R15: filtros, multi-select apagar/arquivar, abrir/editar). "Adicionar canal" → escolher servidor (dropdown) → canal (dropdown) → label → salvar perfil.
3. **Agenda** (por perfil) — toggle + frequência/hora/fuso, ou "só manual".
4. **Saúde** — por perfil: última execução, nº de mensagens, "a atualizar" (delta), erros. Botões **Testar** (valida token+canal+binário sem exportar) e **Importar agora**.

Cada estado **explica**: empty ("Nenhum canal configurado. Adicione o primeiro."), erro (causa + como resolver), sucesso (o que aconteceu + onde ver os rascunhos → link Mesas › Rascunhos).

## 6. Segurança
- Token **encriptado** no DB (`settingsCrypto`), nunca em log/git/env commitado. Preview mascarado (`maskSecret`). O antigo rótulo "Cookies" vira "token de usuário/session"; bot token também é suportado.
- Sincronização automática: ao executar perfil, o backend roda a CLI em JSON, grava o arquivo em pasta interna gerada por perfil e chama `processDiscordChatExporterFolder`/`importDiscordChatExporterJson`; o resultado entra no mesmo fluxo do upload/colar JSON, com mensagens pendentes para parse/importação.
- Binário resolvido **só do env do servidor** (`resolveBinary`), nunca do payload (já implementado — manter).
- `import_dir` gerado pelo backend, não aceito cru do usuário (evita path traversal/escrita arbitrária).
- Timeout no spawn (já existe, 10min).

## 7. Erros comuns + mensagem ao leigo
| Sintoma | Causa | UI diz |
|---|---|---|
| ENOENT no run | binário ausente | "Exportador não instalado no servidor. (infra)" — só admin, com flag de deploy |
| exit≠0 "Forbidden" | bot sem permissão no canal | "O bot não tem acesso a este canal. Dê 'Ver Histórico' a ele." |
| token inválido | token errado/revogado | "Token do bot inválido. Gere um novo em Discord Developers." |
| 0 mensagens | canal vazio/after futuro | "Nenhuma mensagem no período. Ajuste a data inicial." |

## 8. Deploy (o que precisa na VM — uma vez, via Dockerfile/CI, não à mão)
- Dockerfile `mesas-api` (e base do `mesas-cron`): build DCE CLI `-r linux-musl-x64 --self-contained` (tag pinada) → COPY p/ `/opt/dce/` → `chmod +x` → `apk add icu-libs libstdc++` (deps nativas) → `ENV DISCORD_CHAT_EXPORTER_BIN=/opt/dce/DiscordChatExporter.Cli`. Self-contained dispensa runtime .NET no Alpine (`linux-x64` genérico é glibc e falha em musl — ver §2). Volume persistente p/ `import_dir`.
- Secret de encriptação do `settingsCrypto` já existe (mesas). Sem novo segredo manual.

## 9. Tasks (entram na Fase 6 da spec)
- T6.5 (R13) expandida: tabela de perfis + CRUD + UI wizard.
- **T6.6** — Dockerfile bundla a CLI pinada + `DISCORD_CHAT_EXPORTER_BIN`; deploy beta prova `/test` verde (binário encontrado). SDD Completo (toca image/deploy). Coordenar com spec 052 Bloco A (runner agendado).
- **T6.7** — Wizard de conexão (validar token → discovery → perfis) + estados explicativos + guia "como obter token".
- **T6.8** — Saúde por perfil (última run, a-atualizar, erros) + Testar + Importar agora.

## Fontes
- [DiscordChatExporter (repo)](https://github.com/Tyrrrz/DiscordChatExporter)
- [Using the CLI](https://github.com/Tyrrrz/DiscordChatExporter/blob/prime/.docs/Using-the-CLI.md)
- [Docker usage](https://github.com/Tyrrrz/DiscordChatExporter/blob/prime/.docs/Docker.md)
- [Docker image](https://hub.docker.com/r/tyrrrz/discordchatexporter)
