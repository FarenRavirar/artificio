#!/usr/bin/env python3
import sys
import argparse
import os
import psycopg2

def check_environment(dest_dsn: str, dest_host: str, dest_db: str):
    """Verifica se o ambiente de destino NÃO é Produção e ABORTA se for."""
    prod_indicators = [
        "mesas-db",
        "mesas.artificiorpg.com"
    ]

    # Destino tem que validar como mesas-beta-db ou localhost efêmero
    # Mas mesas_rpg também não pode ser o nome do banco se for de prod, mas mesas_rpg é o nome do DB para ambos beta e prod.
    # O principal gate é o HOST ou o DB_NAME caso tentem logar de outra forma.

    for val in [dest_dsn, dest_host, dest_db]:
        if not val: continue
        for prod_ind in prod_indicators:
            if prod_ind in val:
                print(f"ABORT IMEDIATO: Destino indica PRODUÇÃO ({prod_ind} detectado em {val})", file=sys.stderr)
                sys.exit(1)

    if dest_host not in ["mesas-beta-db", "localhost", "127.0.0.1", "::1"]:
        print(f"ABORT IMEDIATO: Host destino não reconhecido como seguro ({dest_host}).", file=sys.stderr)
        sys.exit(1)

TOPOLOGY = [
    # 1. Dicionários Base (Raízes)
    "systems", "scenarios", "platforms", "tags", "vtt_platforms", "communication_platforms", "sources",
    # 2. Extensões de Dicionários
    "scenario_aliases", "scenario_suggestions", "system_aliases", "system_suggestions", "vtt_platform_suggestions", "setting_style_suggestions",
    # 3. Usuários (Core Identidade)
    "users",
    # 4. Dependentes Diretos de Usuário
    "auth_providers", "profiles", "player_profiles", "gm_profiles", "user_preferences", "user_links", "user_systems",
    # 5. Entidade Central de Negócio
    "tables",
    # 6. Agregados da Tabela
    "table_contacts", "table_platforms", "table_schedules", "table_tags", "table_history", "imported_tables", "table_metrics", "gm_profile_metrics",
    # 7. Entidades Sociais/Interativas
    "bookmarks", "table_interests", "questions", "reviews",
    # 8. Dependentes Folhas
    "answers"
]

EXCLUDED_TABLES = {"activity_log", "update_log", "schema_migrations"}

# Tabelas cujo PK e' serial mas tem UNIQUE semantico no FK 1:1. O schema auto-popula
# essas metricas (migration_16/108), entao ON CONFLICT (id) nao pega a colisao de
# UNIQUE(table_id)/UNIQUE(gm_profile_id). Conflitar pela chave semantica (paridade com
# adminHydration.ts) e descartar o id serial p/ nao colidir com a sequencia local do beta.
CONFLICT_OVERRIDE = {
    "table_metrics": ["table_id"],
    "gm_profile_metrics": ["gm_profile_id"],
}

def get_columns(conn, table_name):
    with conn.cursor() as cur:
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s", (table_name,))
        return [row[0] for row in cur.fetchall()]

def get_pks(conn, table_name):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT a.attname
            FROM   pg_index i
            JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE  i.indrelid = %s::regclass
            AND    i.indisprimary;
        """, (table_name,))
        return [row[0] for row in cur.fetchall()]

def check_fk_exists(dest_conn, fk_table, fk_col, fk_val):
    if fk_val is None:
        return True
    with dest_conn.cursor() as cur:
        cur.execute(f"SELECT 1 FROM {fk_table} WHERE {fk_col} = %s", (fk_val,))
        return cur.fetchone() is not None

def get_fks(conn, table_name):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM
                information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s;
        """, (table_name,))
        return cur.fetchall()

def anonymize_val(col, val, row_dict):
    if val is None:
        return None
    if col == "email":
        return f"fake_{row_dict.get('id', 'usr')}@example.com"
    if col == "google_id":
        return f"fake_google_{row_dict.get('id', 'usr')}"
    if col in ["cover_deletehash", "avatar_deletehash", "banner_deletehash"]:
        return "fake_deletehash"
    return val

def sync_table(source_conn, dest_conn, table_name, args):
    if table_name in EXCLUDED_TABLES:
        return

    src_cols = get_columns(source_conn, table_name)
    dst_cols = get_columns(dest_conn, table_name)

    if not src_cols or not dst_cols:
        return

    common_cols = [c for c in src_cols if c in dst_cols]
    pks = get_pks(dest_conn, table_name)

    if not pks:
        # Pular tabelas sem PK
        return

    fks = get_fks(dest_conn, table_name)

    # Busca dados da fonte
    with source_conn.cursor() as cur:
        cur.execute(f"SELECT {', '.join(common_cols)} FROM {table_name}")
        rows = cur.fetchall()

    candidatos = len(rows)
    inseridos = 0
    atualizados = 0
    ignorados = 0

    for row in rows:
        row_dict = dict(zip(common_cols, row))

        # Anonimização
        for col in common_cols:
            row_dict[col] = anonymize_val(col, row_dict[col], row_dict)

        # FK check (SKIP rule)
        skip = False
        for fk_col, fk_table, fk_ref_col in fks:
            if fk_col in row_dict:
                fk_val = row_dict[fk_col]
                if not check_fk_exists(dest_conn, fk_table, fk_ref_col, fk_val):
                    skip = True
                    break

        if skip:
            ignorados += 1
            if args.verbose: print(f"  [{table_name}] SKIP row PK={row_dict.get(pks[0])} (FK constraint failed)")
            continue

        # INSERT ON CONFLICT DO UPDATE
        conflict_cols = CONFLICT_OVERRIDE.get(table_name, pks)

        insert_cols = list(common_cols)
        # Override: descartar o PK serial p/ nao colidir com a sequencia local do beta.
        if table_name in CONFLICT_OVERRIDE:
            insert_cols = [c for c in insert_cols if c not in pks]

        insert_vals = [row_dict[c] for c in insert_cols]
        placeholders = ", ".join(["%s"] * len(insert_cols))

        update_cols = [c for c in insert_cols if c not in conflict_cols]

        conflict_target = ", ".join(conflict_cols)

        if not update_cols:
            query = f"INSERT INTO {table_name} ({', '.join(insert_cols)}) VALUES ({placeholders}) ON CONFLICT ({conflict_target}) DO NOTHING RETURNING 1;"
        else:
            set_clause = ", ".join([f"{c} = EXCLUDED.{c}" for c in update_cols])
            query = f"INSERT INTO {table_name} ({', '.join(insert_cols)}) VALUES ({placeholders}) ON CONFLICT ({conflict_target}) DO UPDATE SET {set_clause} RETURNING (xmax = 0);"

        with dest_conn.cursor() as cur:
            cur.execute(query, insert_vals)
            res = cur.fetchone()
            if res:
                if len(res) > 0 and type(res[0]) == bool:
                    if res[0]: # xmax == 0 significa insert
                        inseridos += 1
                    else:
                        atualizados += 1
                else:
                    inseridos += 1
            else:
                atualizados += 1

    print(f"Tabela {table_name}: {candidatos} candidatos | {inseridos} inseridos | {atualizados} atualizados | {ignorados} ignorados")

def main():
    parser = argparse.ArgumentParser(description="Hidratação de BD: Prod -> Beta")
    parser.add_argument("--dry-run", action="store_true", help="Obrigatório para modo seguro. Apenas simula.")
    parser.add_argument("--tabela", type=str, help="Restringe a execução a uma tabela.")
    parser.add_argument("--verbose", action="store_true", help="Log detalhado")
    args = parser.parse_args()

    source_dsn = os.environ.get("SOURCE_DSN", "")
    dest_dsn = os.environ.get("DEST_DSN", "")
    dest_host = os.environ.get("DEST_HOST", "")
    dest_db = os.environ.get("DEST_DB", "")

    check_environment(dest_dsn, dest_host, dest_db)

    try:
        source_conn = psycopg2.connect(source_dsn)
        source_conn.set_session(readonly=True)
        dest_conn = psycopg2.connect(dest_dsn)

        with dest_conn: # Handle transactions automatically
            tables_to_run = [args.tabela] if args.tabela else TOPOLOGY

            for table in tables_to_run:
                sync_table(source_conn, dest_conn, table, args)

            if args.dry_run:
                print("Modo dry-run: Executando ROLLBACK.", file=sys.stdout)
                dest_conn.rollback()
            else:
                # Transação única atômica
                print("Commiting transação atômica...", file=sys.stdout)
                dest_conn.commit()

    except Exception as e:
        print(f"Erro ao conectar ou sincronizar: {e}", file=sys.stderr)
        if 'dest_conn' in locals() and dest_conn:
            print("Executando ROLLBACK total.", file=sys.stderr)
            dest_conn.rollback()
        sys.exit(1)

    finally:
        if 'source_conn' in locals() and source_conn:
            source_conn.close()
        if 'dest_conn' in locals() and dest_conn:
            dest_conn.close()

if __name__ == "__main__":
    main()
