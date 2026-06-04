# VTT Logos

Esta pasta contém os logos das plataformas VTT (Virtual Tabletop) exibidos no site.

## Padrão de Nomenclatura

Os arquivos devem seguir o padrão: `{slug}.webp`

**Lista completa de nomenclatura (vinculada aos values do select):**

| VTT | Slug (value) | Nome do Arquivo |
|---|---|---|
| Alchemy RPG | `alchemy-rpg` | `alchemy-rpg.webp` |
| D&D Beyond Maps | `dndbeyond-maps` | `dndbeyond-maps.webp` |
| Fantasy Grounds Unity | `fantasy-grounds-unity` | `fantasy-grounds-unity.webp` |
| Foundry VTT | `foundry-vtt` | `foundry-vtt.webp` |
| Owlbear Rodeo | `owlbear-rodeo` | `owlbear-rodeo.webp` |
| Quest Portal | `quest-portal` | `quest-portal.webp` |
| Roll20 | `roll20` | `roll20.webp` |
| Tableplop | `tableplop` | `tableplop.webp` |
| Tabletop Simulator (TTS) | `tabletop-simulator` | `tabletop-simulator.webp` |
| TaleSpire | `talespire` | `talespire.webp` |

## Especificações Técnicas

- **Formato:** WebP com transparência
- **Dimensões:** 
  - Hero: 20px altura (auto width)
  - ActionPanel: 32px altura (auto width)
- **Tamanho máximo:** 30KB por arquivo
- **Fundo:** Transparente
- **Qualidade:** Alta resolução (2x para retina)

## Como Adicionar um Novo Logo

1. Obter logo oficial da VTT (preferencialmente SVG ou PNG de alta qualidade)
2. Converter para WebP com fundo transparente
3. Otimizar com ferramentas como Squoosh ou cwebp
4. Salvar como `{slug}.webp` nesta pasta
5. Atualizar campo `logo_filename` na tabela `vtt_platforms`

## Checklist de Logos

- [ ] alchemy-rpg.webp
- [ ] dndbeyond-maps.webp
- [ ] fantasy-grounds-unity.webp
- [ ] foundry-vtt.webp
- [ ] owlbear-rodeo.webp
- [ ] quest-portal.webp
- [ ] roll20.webp
- [ ] tableplop.webp
- [ ] tabletop-simulator.webp
- [ ] talespire.webp

## Fallback

Se o logo não existir, o sistema exibe apenas o ícone genérico 🎮 e o nome da plataforma.

