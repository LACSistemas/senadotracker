# Contrato de coleta — Censo Escolar (INEP) · G2

Estado: **PASS_WITH_CAVEATS** · Fase consumidora: P10.1–P10.3 · Provas: `censo_escolar_listing_*.json`, `censo_escolar_headers.json`, `dicionario_censo_escolar_2025.json`, `censo_escolar_variaveis_x_ano.csv`, `reproducibilidade/zip_remote_listing.py`, `censo_escola_stream.py`.

## 1. Origem e acesso
- Página: `https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar` (HTTP 200; links para 1995–2025).
- Download direto, **sem chave, sem autenticação**: `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_AAAA.zip`. **Exceção 2025: `…_2025_.zip` (underscore final)**; o padrão quebra sem aviso (P0 já registrou). O coletor deve ler os links da página, não montar a URL por regra.
- O servidor aceita `HEAD` e `Range` (`Accept-Ranges: bytes`) em todos os 31 anos (HEAD de 1995 a 2025: todos 200). Ele derruba conexões de vez em quando (WinError 10054): o cliente precisa de repetição com espera crescente (implementada em `zip_remote_listing.py`).
- Termos de uso: o ZIP de 2025 traz Parecer Jurídico da PFE/INEP, RIP (Relatório de Impacto à Proteção de Dados Pessoais) e TED; **não foram lidos nesta fase**. A licença formal do conjunto fica `NÃO VERIFICADA` (obrigação: ler os PDFs na P10.1 antes de publicar).

## 2. O que existe por edição (medido por leitura do diretório central do ZIP, sem baixar)
| Edições | Formato | Observação |
|---|---|---|
| 1995–2006 | vários CSV (`CENSOESC_AAAA.CSV`, `DADOSCURSO`, `INDICESC`, `MEDPROF`…), layouts antigos, 36–62 MB (ZIP) | **fora do escopo da P10.1** (sem dicionário comum; descontinuidades) |
| 2007–2024 | **um** CSV por ano, `microdados_ed_basica_AAAA.csv`, **uma linha por escola**, 145–218 MB descompactado; dicionário XLSX no ZIP | 2007–2021: 21–26 MB (ZIP); 2022: 26 MB; 2023: 32 MB; 2024: 34 MB |
| 2025 | **seis tabelas** `Tabela_{Escola, Turma, Matricula, Docente, Gestor_Escolar, Curso_Tecnico}_2025_V2.csv`, todas **uma linha por escola** (agregados `QT_*`), ZIP de 537 MB; dicionário XLSX com 6 abas | entradas **STORED** (sem compressão): `Range` funciona sobre o arquivo interno |

Colunas lidas por `Range` (sem baixar o ZIP): Escola 290, Turma 218, Matrícula 263, Docente 184, Gestor 88, Curso Técnico 49; 2024: 426; 2023: 408; 2022: 385; 2021: 370.

## 3. Formato
- Separador `;`, **codificação ISO-8859-1** (decodificação latin-1 confirmada: "Rondônia" correto), datas `10FEB2025:00:00:00` (formato SAS), decimais com ponto, vazio = campo não preenchido.
- Chave da escola: `CO_ENTIDADE` (8 dígitos). Município: `CO_MUNICIPIO` (IBGE 7 dígitos) — confirmado em todas as edições lidas.
- 2025 removeu colunas de endereço/telefone/bairro/CEP presentes em 2023–2024 (`DS_ENDERECO`, `NU_TELEFONE`, `CO_CEP`…). **Os microdados não trazem latitude/longitude** em nenhum ano.

## 4. Contagens verificadas (arquivos oficiais, esta fase)
| Ano | Linhas (escolas) | Municípios distintos |
|---|---:|---:|
| 2021 | 221.140 | 5570 |
| 2022 | 224.649 | 5570 |
| 2023 | 217.625 | 5.570 |
| 2024 | 215.545 | 5.570 |
| **2025** | **214.192** (`Tabela_Escola`); 178.766 escolas com matrícula (`Tabela_Matricula`) | 5.571 |

2025 por dependência (`TP_DEPENDENCIA`): federal 728 · estadual 33.561 · municipal 128.145 · privada 51.758. Situação (`TP_SITUACAO_FUNCIONAMENTO`): 1 em atividade 180.540 · 2 paralisada 29.780 · 3 extinta (no ano) 3.872.

## 5. Dicionário e mudanças metodológicas
- O dicionário XLSX traz, por variável: tipo, tamanho, categoria, **coleta por ano (s/n) de 2007 a 2025** e notas. Extraído integralmente: **1.180 entradas** (Escola 370 · Matrícula 267 · Turma 220 · Docente 186 · Gestor 88 · Curso Técnico 49) → `censo_escolar_variaveis_x_ano.csv`.
- Legenda do próprio dicionário: "Alteração de nomenclatura ou metodologia de cálculo", "Variável nova", "Descontinuidade".
- **Quebra forte em 2019**: 121 das 370 variáveis de Escola começam em 2019 e várias foram renomeadas/redefinidas (ex.: `IN_AGUA_FILTRADA` 2007–2018 → `IN_AGUA_POTAVEL` 2019–2025; `IN_BANHEIRO_*` 2007–2018 → `IN_BANHEIRO` 2019+; `QT_SALAS_EXISTENTES` 2007–2018 → `QT_SALAS_UTILIZADAS_*` 2019+). Séries de infraestrutura não podem ser costuradas entre 2018 e 2019 sem tabela de equivalência.
- Variáveis `IN_*` podem vir **vazias** (não 0): em 2022 há 4.259 escolas em atividade com `IN_INTERNET` vazio (2021, 2023, 2024, 2025: zero vazios). Vazio = não informado, nunca zero (`censo_infra_semantica_nulos_2021_2025.json`).
- `Tabela_Gestor` (88 variáveis, 2019+) e variáveis demográficas das tabelas de Matrícula/Docente são **agregados por escola, mas em escola pequena equivalem a atributos individuais** → regras em `contrato_privacidade_educacao.md`.

## 6. Versões e retificações
- Os nomes mudam ("…_V2", "…_defeso", "md5_…txt" dentro do ZIP); `Last-Modified`: 2024 → 2026-07-08, 2025 → 2026-07-31, 2007–2021 → 2023-03-08. **A mesma edição pode ser republicada.** O contrato de coleta guarda `sha256` do ZIP, `Last-Modified` e o `md5` do próprio ZIP, e trata mudança de hash como nova revisão da edição (publicação com log, não sobrescrita silenciosa).
- Periodicidade: anual. Edição N costuma sair entre jun e ago de N+1 (2025: 2026-07-31).

## 7. Prova pequena executada
`censo_escola_stream.py` leu **em fluxo** (sem salvar ZIP) as tabelas de escola de 2021–2025 e gravou só colunas não pessoais em TSV no D: (fora do repositório): 2021–2024 = ZIPs de 26–34 MB; 2025 = apenas `Tabela_Escola` (141 MB) e `Tabela_Matricula` (123 MB) lidas por `Range` (143 MB e 126 MB de rede; 37 e 33 chamadas). **Custo total de rede ≈ 385 MB.** Resultado: contagens acima, identidade (ver `contrato_identidade_escolas.md`) e reconciliação de matrículas (ver `contrato_matriculas_turmas.md`).

## 8. Contrato do coletor (para a P10.1)
1. Ler a página e extrair os links `download.inep.gov.br` (não montar URL).
2. `HEAD` (tamanho, `Last-Modified`) → decidir download; gravar RAW em `D:\Civica\raw\inep\censo_escolar\AAAA\`; manifesto com sha256.
3. 2007–2024: ler o CSV único; 2025+: ler as seis tabelas; **para 2025+ não baixar `Tabela_Docente` nem `Tabela_Gestor_Escolar` na P10.1** (ver G14).
4. Projeção por whitelist de colunas (nunca "todas as colunas"), construída a partir de `censo_escolar_variaveis_x_ano.csv`.
5. Staging em D:, publicação por (ano) com hash da fatia, `NO_CHANGE` quando o hash repete.
6. Reconciliação: Σ escolas = município = UF = Brasil, e comparação com a Sinopse Estatística do mesmo ano (ver G4).

## 9. Limitações
- Edições 1995–2006 não analisadas além da listagem de arquivos.
- Licença/termos não lidos.
- A tabela `Docente` de 2025 e todas as tabelas de 2007–2024 têm o mesmo nível (escola); **não há microdado individual de aluno ou docente no Censo Escolar aberto** (o microdado individual é de acesso restrito, ver G14).
