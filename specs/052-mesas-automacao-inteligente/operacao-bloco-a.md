# 052 Bloco A — operação local planejada

## Diretórios

Raiz fora do git, sugerida na VM: `/var/lib/artificio/mesas/discord-chat-exporter`.

- `incoming/`: JSONs novos.
- `processing/`: arquivo em processamento.
- `processed/`: JSONs importados + `.meta.json`.
- `error/`: JSONs rejeitados + `.meta.json`.

Permissão alvo: dono `ubuntu`, grupo do deploy, `750` nos diretórios, sem leitura pública.

## Retenção

- `processed/`: 14 dias.
- `error/`: 30 dias.
- Metadados não gravam payload bruto.

## Job

Exportar do Discord para `incoming/`:

```bash
DISCORD_CHAT_EXPORTER_IMPORT_DIR=/var/lib/artificio/mesas/discord-chat-exporter \
DISCORD_CHAT_EXPORTER_BIN=/opt/artificio-tools/DiscordChatExporter.Cli \
DISCORD_CHAT_EXPORTER_CHANNEL_ID=<channel_id> \
DISCORD_CHAT_EXPORTER_TOKEN=<token> \
DISCORD_CHAT_EXPORTER_COOKIES=<cookies_opcional> \
pnpm --filter @artificio/mesas-backend discord:export-chat
```

Importar os JSONs gerados:

```bash
DISCORD_CHAT_EXPORTER_IMPORT_DIR=/var/lib/artificio/mesas/discord-chat-exporter \
pnpm --filter @artificio/mesas-backend discord:import-folder
```

Timer planejado: diário às 03:20 America/Sao_Paulo, export primeiro e import depois.

## Decisão de risco do exporter

O DiscordChatExporter CLI oficial documenta uso de token via `-t/--token`. Isso coloca segredo em argv/process list. O mantenedor aceitou esse risco explicitamente em 2026-06-30 e também autorizou uso de cookies quando necessário.

Mitigação local: scripts não imprimem token/cookies; logs redigem esses valores.
