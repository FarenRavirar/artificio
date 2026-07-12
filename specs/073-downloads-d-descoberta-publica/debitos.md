# Débitos — Spec 073 (Downloads-D)

Achados internos de investigação, lint, build ou auditoria. Vazio por definição no momento da abertura.

## DEB-073-01 — Criador sem conta associada não suportado no schema (T4.1)

🟢 Resolvido (2026-07-12). `migration_013_download_creator_nullable_user.sql` torna `download_creator.user_id` nullable (índice único agora parcial, `WHERE user_id IS NOT NULL`). Confirmado que ownership de material (`materials.ts`/`materialMetadata.ts`/`moderation.ts`) compara sempre `download_material.creator_id === req.user!.userId` — nunca lê `download_creator.user_id` — logo a mudança não afeta ownership. `creators.ts` ajustado: quando `user_id` é `null`, retorna `materials: []` sem consultar `download_material` (crédito-only ainda não tem fluxo de cadastro/UI, mas o schema e a leitura já suportam). Teste novo em `creators.test.ts` cobre o caso.

## DEB-073-02 — `/ir/:destinationId` usa slug do material, não id opaco

🟢 Resolvido (2026-07-12). Nova tabela `download_destination` (`migration_014_download_destination.sql`, 1:1 com `download_material`, índice único em `material_id`). `GET /api/v1/materials/:slug` (get-or-create) agora retorna `destination_id`; nova rota `GET /api/v1/destinations/:id` (`apps/downloads/backend/src/routes/destinations.ts`) resolve para `external_url` só quando o material está `published` (fail-closed, mesma regra da ficha). Frontend: `MaterialPage` navega para `/ir/${material.destination_id}`; `RedirectDestinationPage` usa novo hook `useDestination` em vez de reaproveitar `useMaterial`. `destinationId` agora é de fato opaco e desacoplado do slug — sobrevive a troca futura de slug.

## DEB-073-03 — `/obter/:fileId` é placeholder sem storage real

🟡 Aberto (2026-07-12). `ObterArquivoPage` só mostra aviso "em preparação". Download de arquivo hospedado (`access_kind='managed_upload'`) depende de credencial real de provider (071 T6.2, sem credencial disponível ainda). Implementar quando 071 T6.2 for destravado.
