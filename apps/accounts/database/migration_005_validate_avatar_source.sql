-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-07-31
-- @description: Valida o contrato de avatar_source apos liberar o lock da criacao

-- E015: o runner envolve cada arquivo em uma transacao. Separar VALIDATE da
-- criacao NOT VALID faz o ADD liberar seu lock antes da varredura da tabela
-- sagrada users; juntar as duas operacoes anularia o beneficio do padrao.
-- Mesmo par de `002`/`003`.
ALTER TABLE users VALIDATE CONSTRAINT users_avatar_source_check;
