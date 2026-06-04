-- init.sql
-- Executado automaticamente pelo PostgreSQL na primeira inicialização do container.
-- Apenas garante que o banco existe com encoding correto.
-- O schema completo é aplicado via migration_01_base_schema.sql (execução manual).

-- Confirmar encoding e locale
SELECT pg_encoding_to_char(encoding) AS encoding,
       datcollate,
       datctype
FROM pg_database
WHERE datname = current_database();
