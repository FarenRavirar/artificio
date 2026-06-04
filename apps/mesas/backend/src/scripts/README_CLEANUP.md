# Cleanup de Eventos de Métricas

## Objetivo

O script `cleanupMetricEvents.ts` remove eventos antigos da tabela `table_metric_events` para evitar crescimento ilimitado do banco de dados.

## Por que é necessário?

A tabela `table_metric_events` registra cada ação de métrica (view, click, contact, favorite) para implementar throttling e prevenir abuso. Sem limpeza periódica, a tabela cresceria indefinidamente.

## Política de Retenção

**Padrão:** 48 horas

Eventos mais antigos que 48 horas são removidos porque:
- O maior throttle é de 24 horas (favorite)
- 48 horas dá margem de segurança 2x
- Mantém histórico recente para análise de padrões de abuso

## Execução

### Manual (Local)

```bash
cd backend
npm run metrics:cleanup
```

### Manual (Servidor)

```bash
ssh -F C:\projetos\config faren
cd /opt/mesas-beta
docker exec mesas-beta-api npm run metrics:cleanup
```

### Automático (Cron)

**Recomendação:** Executar diariamente às 3h da manhã (horário de menor tráfego)

#### Opção 1: Cron no Host

```bash
# Editar crontab no servidor
crontab -e

# Adicionar linha:
0 3 * * * docker exec mesas-beta-api npm run metrics:cleanup >> /var/log/metrics-cleanup.log 2>&1
```

#### Opção 2: Cron dentro do Container

Adicionar ao `Dockerfile`:

```dockerfile
RUN apt-get update && apt-get install -y cron
COPY cleanup-cron /etc/cron.d/cleanup-cron
RUN chmod 0644 /etc/cron.d/cleanup-cron
RUN crontab /etc/cron.d/cleanup-cron
```

Criar arquivo `cleanup-cron`:

```
0 3 * * * cd /app && npm run metrics:cleanup >> /var/log/cron.log 2>&1
```

## Monitoramento

### Verificar Tamanho da Tabela

```sql
-- No banco
SELECT 
  COUNT(*) as total_events,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  pg_size_pretty(pg_total_relation_size('table_metric_events')) as table_size
FROM table_metric_events;
```

### Alertas Recomendados

- **Crítico:** Tabela com mais de 1 milhão de registros
- **Aviso:** Eventos mais antigos que 72 horas (cleanup não rodou)
- **Info:** Cleanup removeu mais de 100k registros (tráfego alto)

## Troubleshooting

### Erro: "Cannot find module"

**Causa:** Script não foi compilado.

**Solução:**
```bash
npm run build
node dist/scripts/cleanupMetricEvents.js
```

### Erro: "Connection timeout"

**Causa:** Banco de dados inacessível.

**Solução:** Verificar `DATABASE_URL` e conectividade.

### Cleanup muito lento

**Causa:** Tabela muito grande sem índice.

**Solução:** Verificar índice em `created_at`:
```sql
CREATE INDEX IF NOT EXISTS idx_metric_events_cleanup 
ON table_metric_events(created_at);
```

## Ajustar Retenção

Para alterar o período de retenção, editar `cleanupMetricEvents.ts`:

```typescript
const RETENTION_HOURS = 72; // Manter 72 horas ao invés de 48
```

**Importante:** Retenção deve ser sempre maior que o maior throttle (24h para favorite).

## Logs

O script produz logs estruturados:

```
[Cleanup] Iniciando limpeza de eventos de métricas com mais de 48h...
[Cleanup] ✅ Removidos 15234 eventos antigos (antes de 2026-04-05T15:26:00.000Z)
[Cleanup] Estatísticas atuais:
  - Total de eventos: 8456
  - Evento mais antigo: 2026-04-06T10:15:23.456Z
  - Evento mais recente: 2026-04-07T15:26:48.123Z
```

## Impacto em Produção

- **Performance:** Operação rápida (< 1s para até 100k registros)
- **Lock:** DELETE usa lock de linha, não bloqueia leituras
- **Downtime:** Zero - operação online
- **Rollback:** Não aplicável (dados deletados não são recuperáveis)

## Backup Antes de Cleanup (Opcional)

Para ambientes críticos, fazer backup antes:

```bash
docker exec mesas-beta-db pg_dump -U admin -d mesas_rpg -t table_metric_events > backup_metrics_$(date +%Y%m%d).sql
```
