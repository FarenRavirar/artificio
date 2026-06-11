import pandas as pd
import json
import os

def converter_xlsx_para_json(xlsx_path, json_path):
    print(f"Lendo arquivo: {xlsx_path}")
    
    if not os.path.exists(xlsx_path):
        print(f"Erro: Arquivo {xlsx_path} não encontrado.")
        return

    # Mapeamento de colunas conforme o schema definido na arquitetura
    # Coluna A: Nome em Inglês -> nome_en
    # Coluna B: Nome em Português -> nome_pt
    # Coluna C: Validação -> validacao
    # Coluna D: Referência -> referencia
    # Coluna E: Categoria -> categoria
    # Coluna F: Subcategoria -> subcategoria
    # Coluna G: Informação -> informacao
    
    try:
        # O cabeçalho real está na linha 2 (0-indexed)
        # 0: Grande Glossário
        # 1: NaN
        # 2: Nome em Ingles ...
        df = pd.read_excel(xlsx_path, header=2)
        
        # Mapeamento corrigido conforme inspeção final
        mapping = {
            'Nome em Ingles': 'nome_en',
            'Nome em Portugues': 'nome_pt',
            'Validação': 'validacao',
            'Referência': 'referencia',
            'Categoria': 'categoria',
            'Subcategoria': 'subcategoria',
            'Informação': 'informacao'
        }
        
        # Filtra apenas as colunas que existem no mapping
        df = df[list(mapping.keys())].rename(columns=mapping)
        
        # Remove linhas onde nome_en está vazio
        df = df.dropna(subset=['nome_en'])
        
        # Converte para lista de dicionários
        dados = df.to_dict(orient='records')
        
        # Adiciona um ID incremental
        for i, item in enumerate(dados):
            item['id'] = i + 1
            # Limpa valores NaN e converte datetime para string
            for key in item:
                val = item[key]
                if pd.isna(val):
                    item[key] = ""
                elif isinstance(val, (pd.Timestamp, pd.Series)):
                    item[key] = str(val)
                elif hasattr(val, 'isoformat'): # Para objetos datetime puros
                    item[key] = val.isoformat()

        # Garante o diretório do JSON
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        
        # Salva o JSON em UTF-8
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
            
        print(f"Sucesso! {len(dados)} termos convertidos para {json_path}")

    except Exception as e:
        print(f"Erro durante a conversão: {str(e)}")

if __name__ == "__main__":
    XLSX_FILE = "glossario.xlsx"
    JSON_FILE = "public/data/glossario.json"
    converter_xlsx_para_json(XLSX_FILE, JSON_FILE)
