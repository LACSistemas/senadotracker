# Contrato de aprendizagem: Ideb, Saeb, rendimento e fluxo · G6

Estado: **PASS_WITH_CAVEATS** · Fase consumidora: P10.4 (escola depende de P10.1) · Provas: `ideb_2025_listing.json`, `ideb_2025_{brasil,ufs,municipios_ai}_head.json` (arquivos oficiais baixados e lidos), dimensões de `ideb_2025_escolas_*` (leitura do XML da planilha por Range), `saeb_2025_head.json` + `saeb_2025_dicionario.json`, `inep_indicadores_arquivos.csv`.

## 1. Quatro coisas diferentes (nunca misturar)
| Conceito | O que é | Onde está |
|---|---|---|
| **Saeb** | avaliação amostral/censitária de proficiência (Língua Portuguesa, Matemática) em 2º/5º/9º ano EF e EM | `saeb_2025_brasil_estados_municipios_censitario.xlsx` (Brasil/Estados/Municípios) e colunas `VL_NOTA_*` dos arquivos do Ideb |
| **Rendimento** | aprovação, reprovação, abandono (Censo Escolar, ano anterior) | `tx_rend_*` do INEP; `VL_APROVACAO_*` e `VL_INDICADOR_REND_*` (P) no Ideb |
| **Fluxo/distorção** | distorção idade-série (TDI), taxas de transição | `TDI_*`, `tx_transicao_*` |
| **Ideb** | **indicador composto oficial** = N (nota padronizada do Saeb) × P (indicador de rendimento); metas 2007–2021 | `divulgacao_*_ideb_2025.zip` |

## 2. Ideb 2025: disponível, sem chave, em arquivo
Página: `https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados` (o conteúdo carrega por abas, `…/resultados/2005-2025`). Arquivos (todos 200):
| Granularidade | Arquivo | ZIP | Dimensão da planilha |
|---|---|---:|---|
| Brasil (EF e EM) | `divulgacao_brasil_ideb_2025.zip` | 85 KB | AI A1:EB30 · AF A1:DP30 · EM A1:DR25 |
| Regiões e UFs | `divulgacao_regioes_ufs_ideb_2025.zip` | 758 KB | AI A1:EA152 · AF A1:DP151 · EM A1:DP120 |
| Municípios | `divulgacao_{anos_iniciais,anos_finais,ensino_medio}_municipios_2025.zip` | 25,3 + 24,4 + 8,5 MB | AI A1:EC14547 |
| Escolas | `divulgacao_{anos_iniciais,anos_finais,ensino_medio}_escolas_2025.zip` | 112,2 + 80,1 + 19,0 MB | AI A1:EG66164 (≈ 66,1 mil linhas de escolas) |
| EM integrado | `divulgacao_{brasil,ufs}_Ensino_Medio_integrado_ideb_2025.xlsx` | 21 KB (Brasil) | — |
- **Cada arquivo traz todas as edições em colunas** (2005, 2007, …, 2023, 2025): uma só coleta (2025) cobre a série inteira. Total dos arquivos de 2025 ≈ 270 MB.
- Variáveis (nomes reais): `VL_APROVACAO_AAAA_{SI_4,SI,1..5}`, `VL_INDICADOR_REND_AAAA` (P), `VL_NOTA_MATEMATICA/PORTUGUES/MEDIA_AAAA` (N), **`VL_OBSERVADO_AAAA` (Ideb)**, `VL_PROJECAO_AAAA` (meta, 2007–2021). Linhas por **rede** (Total/Estadual/Municipal/Pública/Privada). Municipal: `SG_UF`, `CO_MUNICIPIO` (IBGE 7), `NO_MUNICIPIO`, `REDE`.
- **Ausência é "-"**: o município sem rede municipal tem "-" (não zero). O leitor deve mapear "-" → ausente.
- Notas de rodapé: o ano de 2021 tem nota própria na planilha (edição de pandemia); a leitura deve preservar a marca.
- Nota informativa 2025: `https://download.inep.gov.br/ideb/resultados/nota_informativa_ideb_2025.pdf`.
- Prova de leitura: Brasil, UFs e Municípios AI foram **baixados (26 MB) e lidos**; escolas lidas só por dimensão (o cabeçalho de texto está em `sharedStrings`, no fim do arquivo de 55 MB). A leitura completa de escola exige baixar o ZIP (112 MB) na P10.4.

## 3. Saeb 2025
- `https://download.inep.gov.br/saeb/resultados/saeb_2025_brasil_estados_municipios_censitario.xlsx` (24,3 MB, publicado em 2026-08-07, **baixado e lido**): abas Dicionário (119 variáveis), Brasil (A1:DK64), Estados (A1:DL1548), **Municípios (A1:DI69779)**.
- Variáveis: `MEDIA_5_LP/MT`, `MEDIA_9_LP/MT`, `MEDIA_12_LP/MT` (+ 13), percentuais por nível de proficiência (`nivel_*_LP/MT`, 46 e 54 colunas); recortes `DEPENDENCIA_ADM` × `LOCALIZACAO` × `CAPITAL`.
- Sem arquivo de resultados **por escola** em 2025; notas por escola vêm das colunas `VL_NOTA_*` do Ideb.
- **Microdados Saeb** (nível aluno, anonimizados): publicados até 2023 (`microdados_saeb_2023.zip`, etc.). **Não ingerir** (G14). Saeb 2025: sem microdados listados nesta data.
- Edições anteriores: planilhas `saeb_2021_brasil_estados_municipios*.xlsx`, `Resultados_Saeb_2019…xlsx`, `planilha_de_resultados_2023.rar` (RAR: precisa de extrator; a edição 2023 já está nas colunas do Ideb).

## 4. Rendimento e fluxo (INEP Indicadores)
`tx_rend_{escolas,municipios,brasil_regioes_ufs}_AAAA.zip` (2007–2025), `TDI_AAAA_*` (2006/2007–2025), `tx_transicao_*` (2007–2021, sem nível escola). Tamanhos 2025: tx_rend escolas 67 MB; TDI escolas 34 MB. Os indicadores são calculados pelo INEP: **preferir os oficiais**.

## 5. Regras de interpretação (vinculantes)
1. **Rede ≠ média de escolas.** Ideb da rede municipal/estadual/UF/Brasil vem **da própria linha do arquivo**; **nunca** `AVG(Ideb das escolas)`.
2. **Ausência ≠ zero**: "-" é "não divulgado/não aplicável".
3. **Etapas distintas** (AI = 1º–5º; AF = 6º–9º; EM) **não se comparam nem se somam**.
4. **Edição do Saeb/Ideb ≠ exercício fiscal**: o Ideb 2025 é um resultado de uma edição; cruzar com gasto exige alinhamento explícito (defasagem), nunca "mesmo ano".
5. Nem toda escola tem Ideb (o arquivo traz "-" onde não há divulgação; o critério de participação mínima está na nota informativa, não lida integralmente nesta fase). Escola sem Ideb mostra "não divulgado", nunca "baixo".
6. A planilha marca o ano de 2021 com nota de rodapé própria; o gráfico marca essa edição como descontinuidade e a leitura da nota informativa 2025 é obrigatória na P10.4 antes de comparar 2021/2023/2025.
7. Saeb e Ideb não são sinônimos: a nota Saeb padronizada (N) é componente do Ideb; exibir os dois com o nome certo.
8. Município pequeno: sem comparação com a mediana quando o grupo comparável tiver menos de 5 redes (regra de benchmark G13).

## 6. Disponibilidade pública × consulta em sistema
| Item | Classe |
|---|---|
| Ideb 2005–2025 Brasil/UF/município/escola | arquivo público (zip/xlsx/ods) |
| Saeb 2025 Brasil/Estado/Município | arquivo público (xlsx) |
| Saeb por escola | só via colunas do Ideb; microdados de aluno são dado protegido para uso individual |
| Portal `ideb.inep.gov.br` / "Painel" | consulta em sistema; **não** usado como fonte |

## 7. Contrato do coletor (P10.4)
Descobrir links na página (aba `/resultados/2005-2025`), `HEAD` + hash, RAW em `D:\Civica\raw\inep\ideb\2025\`, ler XLSX por fluxo, normalizar "-" para ausente, formato longo (entidade × etapa × rede × edição × medida), publicação por edição, reconciliação: nº de municípios × rede = linhas da planilha; Ideb = N×P dentro da tolerância de arredondamento oficial (teste a definir; **não executado** nesta fase).

## 8. Limitações
- Cabeçalho completo das planilhas de escola e das planilhas de EM não foi lido.
- Fórmula N×P não foi reproduzida nesta fase.
- Planilhas de Saeb de 2019 e 2021 não foram abertas.
