import os
import json
import re

# File paths
GLOSSARIO_PATH = r"C:\projetos\glossario_artificio\public\data\glossario.json"
MAP_CATEGORIES_PATH = os.path.join(os.path.dirname(__file__), 'map_categories.json')
OUTPUT_SQL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), '03_seed_terms.sql')

def load_json(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return None

def main():
    print("Iniciando importação offline v1 -> v2...")
    
    data = load_json(GLOSSARIO_PATH)
    category_map = load_json(MAP_CATEGORIES_PATH)
    
    if not data or not category_map:
        print("Erro: dados originais ou mapeamento não encontrados.")
        return

    print(f"Total de termos lidos no v1: {len(data)}")
    
    # regex for getting book and page: e.g. "LdMe, 286, Não Capitaliza"
    ref_pattern = re.compile(r'^([^,]+),\s*(\d+)')

    # SQL generation
    sql_lines = []
    sql_lines.append("-- =============================================================================")
    sql_lines.append("-- GLOSSÁRIO ARTIFÍCIO RPG v2 — SEED: TERMOS v1")
    sql_lines.append(f"-- Total terms: {len(data)}")
    sql_lines.append("-- =============================================================================\n")
    
    # The user asked to create a user "FarenRavirar". In an offline SQL script we can't safely insert into auth.users.
    # The script relies on the user being created via Dashboard. We'll use a dynamic subquery.
    user_subquery = "(SELECT id FROM public.users WHERE full_name ILIKE '%FarenRavirar%' OR full_name ILIKE '%faren%' LIMIT 1)"
    system_subquery = "(SELECT id FROM public.systems WHERE slug = 'dnd-5e' OR name ILIKE '%D&D%5e%' LIMIT 1)"

    sql_lines.append(f"DO $$")
    sql_lines.append(f"DECLARE")
    sql_lines.append(f"  v_added_by uuid;")
    sql_lines.append(f"  v_system_id uuid;")
    sql_lines.append(f"BEGIN")
    sql_lines.append(f"  v_added_by := {user_subquery};")
    sql_lines.append(f"  v_system_id := {system_subquery};")
    sql_lines.append(f"")

    terms_without_category = 0
    
    for i, item in enumerate(data):
        nome_en = str(item.get('nome_en', '')).replace("'", "''")
        nome_pt = str(item.get('nome_pt', '')).replace("'", "''")
        if not nome_en and not nome_pt:
            continue
            
        validacao = str(item.get('validacao', '')).strip()
        referencia = str(item.get('referencia', '')).strip()
        categoria = str(item.get('categoria', '')).strip()
        subcat = str(item.get('subcategoria', '')).strip()
        info = str(item.get('informacao', '')).strip()

        # Transformation rules
        nucleus = "'sugestao'"
        status = "'pendente'"
        
        if validacao == 'Oficial':
            nucleus = "'oficial'"
            status = "'verificado'"
        elif validacao == 'Informal':
            nucleus = "'sugestao'"
            status = "'verificado'"
        elif validacao == 'Não Validado Recentemente':
            nucleus = "'sugestao'"
            status = "'pendente'"
            
        # Parser for references
        book_ref = "NULL"
        page_ref = "NULL"
        
        if referencia:
            match = ref_pattern.search(referencia)
            if match:
                b = match.group(1).strip().replace("'", "''")
                p = match.group(2).strip().replace("'", "''")
                book_ref = f"'{b}'"
                page_ref = f"'{p}'"
                
                # everything after the match goes into info
                remainder = referencia[match.end():].strip(', ').strip().replace("'", "''")
                if remainder:
                    info = f"{remainder} | {info}" if info else remainder
            else:
                # If no comma/number combo, assume whole string is book reference if no comma,
                # else just put it all in info for admin review to avoid errors on the frontend 
                if ',' not in referencia:
                    book_ref = f"'{referencia.replace(chr(39), chr(39)+chr(39))}'"
                else:
                    info = f"{referencia.replace(chr(39), chr(39)+chr(39))} | {info}" if info else referencia.replace(chr(39), chr(39)+chr(39))

        if info:
            info = f"'{info}'"
        else:
            info = "NULL"
            
        # Category lookup
        mapped_slug = "NULL"
        if categoria in category_map:
            subdict = category_map[categoria]
            if subcat in subdict:
                mapped_slug = f"'{subdict[subcat]}'"
            elif '*' in subdict:
                mapped_slug = f"'{subdict['*']}'"
                
        if mapped_slug == "NULL":
            terms_without_category += 1
            cat_subquery = "NULL"
        else:
            cat_subquery = f"(SELECT id FROM public.categories WHERE slug = {mapped_slug})"
            
        sql_lines.append(f"  INSERT INTO public.terms (name_en, name_pt, nucleus, status, source_type, system_id, category_id, added_by, book_reference, page_reference, additional_info)")
        sql_lines.append(f"  VALUES ('{nome_en}', '{nome_pt}', {nucleus}, {status}, 'sistema', v_system_id, {cat_subquery}, v_added_by, {book_ref}, {page_ref}, {info});")
        
        # Batch insert chunks of 500 for better performance?
        # Supabase blocks can handle thousands, but just doing a block of INSERTS inside a DO block is fine.
        
    sql_lines.append(f"END $$;")
    
    with open(OUTPUT_SQL_PATH, 'w', encoding='utf-8') as sf:
        sf.write("\n".join(sql_lines))
        
    print(f"Sucesso! Gerado o arquivo: {OUTPUT_SQL_PATH}")
    print(f"Dos {len(data)} termos, {terms_without_category} ficaram sem categoria inicial (category_id = NULL) para moderação.")
    print("\nAVISO: Não esqueça de criar o sistema 'D&D 5e' e o usuário 'FarenRavirar' no banco base para que os vínculos funcionem!")

if __name__ == '__main__':
    main()
