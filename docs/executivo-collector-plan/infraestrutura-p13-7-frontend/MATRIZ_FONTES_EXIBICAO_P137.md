# P13.7 — Matriz de fontes × exibição

Mapeamento real entre cada família do catálogo (ver `MATRIZ_FONTES_COBERTURA_PERIODOS.csv`, corrigida no G0.1) e onde ela aparece no frontend. `MODULE_FAMILIES` em `lib/infrastructure/catalog.ts` é a fonte única desta correspondência no código.

| Família | Indicadores | Módulo/capítulo | Território suportado | Observação de exibição |
|---|---|---|---|---|
| SINISA | 16 | Água e saneamento | MUNICIPIO;UF;BRASIL | 4 grupos: Abastecimento, Esgotamento, Resíduos, Gestão |
| ENTORNO_IBGE | 30 | Ruas e ambiente urbano | MUNICIPIO;UF;BRASIL | Alternador de 3 unidades (FACE/HOUSEHOLD/RESIDENT); nunca misturadas no mesmo gráfico |
| FAVELAS | 5 | Habitação | MUNICIPIO;UF;BRASIL (684 municípios com registro) | Nota de que ausência ≠ ausência de precariedade |
| FJP | 2 | Habitação | UF;BRASIL | Nunca exibido como valor municipal |
| INTERNET_DOMICILIAR | 2 | Habitação | MUNICIPIO;UF;BRASIL | Domicílios e moradores sempre separados |
| MUNIC_URBANA | 4 | — (não exibido nesta fase) | MUNICIPIO | 4 indicadores (IAP/IGR) ainda sem módulo dedicado; aparecem no explorador completo, não num capítulo curado |
| MUNIC_TRANSPORTE | 12 | Mobilidade e logística | MUNICIPIO | Grupo "Estrutura de mobilidade (MUNIC)" |
| PEMOB | 7 | Mobilidade e logística | MUNICIPIO (96 respondentes) | Nota de cobertura parcial fixa |
| SNISB | 4 | Segurança hídrica | MUNICIPIO | Grupo "Barragens (SNISB)" |
| ANM | 3 | Segurança hídrica | MUNICIPIO | Grupo "Barragens de mineração (SIGBM/ANM)"; nota de não-deduplicação com SNISB |
| ATLAS_AGUAS | 6 | Segurança hídrica | **só BRASIL hoje** | Grupo existe no código mas nunca populado em página de UF/município — ver `CONTRATO_TERRITORIALIDADE_P137.md` |
| ANEEL_INDGER | 7 | Energia e conectividade | MUNICIPIO | Grupo "Serviços elétricos (ANEEL)" |
| MMGD | 4 | Energia e conectividade | MUNICIPIO;UF;BRASIL (lacuna de 19 municípios, G0.2) | Grupo "Geração distribuída (MMGD)"; nota de lacuna de publicação |
| ANP | 2 | Energia e conectividade | MUNICIPIO;UF;BRASIL (GLP parcial; preços bloqueados) | Grupo "Combustíveis (ANP)" |
| LOGISTICA | 4 | Mobilidade e logística | MUNICIPIO;UF;BRASIL | Grupo "Logística"; nota de referências temporais diferentes (SNV jul/2024 vs pavimento set/2026) |

Total: 91 (domínio 5) + 7 (domínio 6) + 10 (domínio 13) = **108**, igual ao total auditado em P13.6.

## Indicadores sem módulo curado dedicado

`MUNIC_URBANA` (4 indicadores: pavimentação de vias públicas urbanas, rede de águas pluviais, risco de inundação, população impactada por eventos hidrológicos) não ganhou capítulo próprio nesta fase — não estava explicitamente pedido como módulo no brief (seções 9–14 cobrem água/ruas/habitação/energia/mobilidade/obras/segurança-hídrica; MUNIC_URBANA fica entre "ruas" e "segurança hídrica" tematicamente, mas decidiu-se não forçar um oitavo capítulo). Esses 4 indicadores continuam acessíveis via `IndicatorExplorer` (catálogo completo), nunca escondidos — só não têm narrativa curada própria.

## Instalações físicas (`exec_log_facility`)

496 registros reais, **todos** do tipo `AERODROME_PUBLIC` (ANAC), com coordenadas oficiais publicadas (não derivadas de centroide). Descoberta: a coluna `ibge7` dessa tabela é sempre `NULL` — o filtro por município em `getInfrastructureFacilities` (que usa `ibge7=$1`) nunca retorna resultado em nível município, só em UF/Brasil (onde o filtro por `uf` funciona). Não corrigido nesta fase (exigiria casar por nome textual de município, arriscado sem normalização) — os aeródromos aparecem hoje só via o indicador `LOG-ANAC-PUBLIC-AERODROMES` (contagem), não como lista navegável de instalações individuais. Documentado como pendência para decisão em fase futura, não escondido.
