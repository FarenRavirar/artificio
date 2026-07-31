-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-07-30
-- @description: Valida o contrato de papel global após liberar o lock da criação

-- E015: o runner envolve cada arquivo em uma transação. Separar VALIDATE da
-- criação NOT VALID faz o ADD liberar seu lock antes da varredura da tabela
-- sagrada users; juntar as duas operações anularia o benefício do padrão.
ALTER TABLE users VALIDATE CONSTRAINT users_role_check;
