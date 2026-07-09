# Plano — Spec 061

## Fases da investigação

### F-1 — Fonte única de sistemas/edições

Levantar completamente as implementações existentes em `apps/mesas` e `apps/glossario`: schemas, dados, APIs, telas admin, IDs, aliases, edições, consumidores e divergências. A unificação em um banco/catálogo canônico é requisito firme; comparar onde ele vive, ownership, contratos de acesso, migração, rollout e rollback.

**Saída:** primeira spec filha, SDD Completo, exclusivamente de investigação/decisão e plano de unificação. Ela bloqueia todas as specs executáveis de `downloads`.

### F0 — Evidência interna e restrições

Ler decisões, arquitetura, mídia compartilhada, shell/nav, auth, analytics e deploy. Registrar que não existe legado WP de `downloads`; confirmar no código real os contratos reutilizáveis antes de congelar qualquer solução.

**Saída:** inventário do que já existe, do que pode ser reutilizado e do que ainda não existe.

**Resultado T0.4:** concluído. `apps/mesas` é baseline técnico principal: stack, separação frontend/backend/database, ownership, perfis, painel, gestão, moderação, filtros, contratos, validação, testes e deploy. `apps/links` é referência complementar de sugestão simples/denúncia. Gaps: permissionamento app-local, workflow editorial, comentários/reviews/coleções e adapter multi-storage.

### F1 — Pesquisa de produto e mercado

Investigar Dungeonist histórico como referência visual e DriveThruRPG como referência máxima de configuração. Capturar snapshot datado de campos, taxonomias e filtros do DriveThruRPG; transformar em matriz adotar/adaptar/excluir. Toda mecânica comercial será explicitamente excluída.

**Saída:** matriz de referências; padrões úteis; antipadrões; diferenças necessárias para o Brasil/Artifício.

**T1.1 concluído:** Dungeonist reconstruído por triangulação. Era marketplace brasileiro de PDFs pagos/gratuitos para autores/editoras independentes, com aprovação, pagamentos, suporte e comissão. Encerramento revelou custo operacional. UI/filtros/schema não foram recuperados; não serão inventados.

**T1.1b concluído:** matriz DriveThruRPG → Artifício registrada no `spec.md`. Ficha, taxonomias, formatos, moderação, perfis, versões e recursos de usuário mapeados; comércio excluído. T1.2 fica restrito à enumeração literal dos valores atuais de filtros.

### F2 — Definição do produto

Fechar proposta de valor, públicos, jornadas, política de gratuidade/PWYW externo, comprovação de permissão, escopo MVP e indicadores de sucesso.

**Saída:** product brief e decisões candidatas para `decisions.md`.

### F3 — Conteúdo, taxonomia e governança

Definir metadados, vocabulários controlados, relações entre sistema/edição, licença, classificação, estados editoriais e política de remoção.

**Saída:** dicionário de dados conceitual + matriz de moderação.

### F4 — UX e arquitetura de informação

Definir mapa de páginas, sidebar, submenu abaixo do nav, busca/filtros, responsividade, detalhe, submissão, área do publicador e gestão admin.

**Saída:** fluxos e wireframes textuais; requisitos de acessibilidade e estados vazios/erro/loading.

### F5 — Arquitetura técnica e segurança

Investigar modelo de dados, APIs, SSO/roles, CSRF, rate limit, URLs externas, anti-spam, Cloudinary signed, analytics, SEO, privacidade e adapter multi-storage. Comparar quotas/APIs/egress/limites de R2, B2, Fastio e Cloudinary PDF; definir failover sem quebrar URLs. Usar bundle API como fonte primária quando houver contrato proposto.

**Saída:** ADRs propostas, threat model leve e plano de testes.

### F6 — Operação, infraestrutura e deploy

Aplicar a `downloadsbeta.artificiorpg.com` e `downloads.artificiorpg.com` exatamente o padrão beta/prod vigente dos outros módulos: migrations, compose, manifesto, Tunnel/DNS, backup, observabilidade e gates, sem criar fluxo próprio.

**Saída:** plano operacional sem executar infraestrutura.

### F7 — Decomposição em specs filhas

Validar dependências e abrir as specs abaixo somente após decisões suficientes.

## Ordem proposta das próximas specs

1. **Fonte única de sistemas/edições — investigação e decisão** — audita mesas/glossário, compara soluções e planeja unificação; bloqueia todas as specs executáveis.
2. **Produto, pesquisa e políticas** — fecha público, MVP, gratuidade, autoria, licença e moderação.
3. **Taxonomia e modelo de conteúdo** — fecha entidades, campos, estados e vocabulários; depende de 1–2.
4. **UX, IA e design** — sidebar, submenu, páginas, responsivo e acessibilidade; depende de 2–3.
5. **Arquitetura, segurança e contratos API** — banco, endpoints, SSO, permissões app-local, abuse controls, Cloudinary e storage de arquivos; depende de 1–4.
6. **Storage multi-provider** — implementação obrigatória de R2 + B2 + Fastio, adapter, URL estável, quotas e failover; Cloudinary PDF como último fallback; depende de 5.
7. **Infraestrutura e ambientes beta/prod** — integrar hosts `downloadsbeta.`/`downloads.` à esteira canônica vigente, com paridade aos outros módulos e zero snowflake; depende de 5–6.
8. **Backend foundation** — migrations, domínio, auth, APIs públicas e submissão; depende de 1 e 5–7.
9. **Moderação e área do publicador** — fila admin, revisão, histórico, recurso, denúncias e gestão própria; depende de 8.
10. **Frontend público** — catálogo, busca, filtros, sidebar, detalhe, SEO e analytics; depende de 4 e 8.
11. **Frontend de submissão** — formulário, capas Cloudinary, arquivo/link, preview, drafts e validações; depende de 4, 6, 8 e 9.
12. **Curadoria inicial e catálogo-semente** — selecionar materiais externos autorizados e testar taxonomia/moderação; não há legado WP a importar.
13. **Deploy beta + QA** — CI, deploy beta, segurança, a11y, Lighthouse, E2E e smoke.
14. **Lançamento prod + Gate D** — conteúdo mínimo, moderação operacional, smoke, monitoramento e rollback.

Cada item será uma spec própria. Se uma investigação revelar blast radius compartilhado, ela permanece SDD Completo.

## Princípios de ordenação

- Produto antes de schema.
- Schema e UX antes de contrato API.
- Segurança antes de aceitar submissão pública.
- Ambiente antes de feature dependente de persistência.
- Backend antes dos clientes finais.
- Beta e operação real antes de prod.
- Migração de legado só após modelo estável.
