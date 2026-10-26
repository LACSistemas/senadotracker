# Licença e uso dos dados do INEP · G1

Estado: **PASS_WITH_CAVEATS** (a pendência documental da P10.1 foi resolvida pela leitura dos documentos oficiais da distribuição; a conclusão jurídica sobre redistribuição de tabelas derivadas fica como `NEEDS_LEGAL_VALIDATION`). **Esta nota é leitura técnica de documentos públicos, não parecer jurídico.**

## 1. O que foi lido (e como)
Documentos copiados por Range do ZIP oficial do Censo Escolar 2025 (`download.inep.gov.br/dados_abertos/microdados_censo_escolar_2025_.zip`, `Last-Modified` 2026-07-31) para `D:\Civica\raw\inep\docs\2025\` (hashes no `exec_raw_manifest`, dataset `inep_censo_escolar_docs_2025`) e convertidos em texto (`reproducibilidade/pdf_text.py`):

| Documento | Páginas | Leitura |
|---|---:|---|
| Manual do Usuário (`Leia-me_v2.pdf`, julho de 2026, versão 2) | 10 | integral |
| Parecer Jurídico PF-INEP nº 00018/2022 (17/02/2022) | 13 | início, conclusão e trechos por palavra-chave (LGPD, divulgação, anonimização, finalidade pública) |
| RIP – Relatório de Impacto à Proteção de Dados Pessoais dos Censos Educacionais | 32 | por palavra-chave (agregação, divulgação, terceiros, licença) |
| Nota Técnica nº 5/2021 (TED 8750, UFMG) | 6 | sumário e recomendações |
| Questionário de Turma 2025 | 3 | referência de campos |
| Termo de Execução Descentralizada INEP–UFMG (21 MB) | – | **não copiado**: só citado pelo Manual |
| Nota Técnica nº 12/2023 da ANPD | – | **citada pelo Manual e ausente do ZIP**: não lida |

Também foram lidos os rodapés das páginas gov.br do INEP (`/microdados/censo-escolar` e `/dados-abertos`), salvos em staging.

## 2. O que os documentos dizem
1. **Finalidade e enquadramento.** O Manual declara que os microdados são divulgados "em atendimento à Lei nº 12.527/2011 (Lei de Acesso à Informação) e à Lei nº 13.709/2018 (LGPD)", como instrumento de transparência, e que passam a ser "estruturados ao nível de estabelecimentos de ensino" (uma linha por escola, com contagens), acessíveis a "pesquisadores, estudantes, gestores e sociedade em geral".
2. **Agregação territorial é o uso previsto.** O Manual traz um exemplo de consolidação de escola + matrícula "em diferentes níveis de agregação, incluindo Brasil, Regiões Geográficas, Unidades da Federação, Municípios" e diz que a tabela resultante é "adequada para análises estatísticas, elaboração de painéis informativos ou disseminação institucional".
3. **Condição central: não reidentificar pessoas.** O Parecer conclui que, se a divulgação "puder resultar em acesso, por terceiros, a microdados pessoais não anonimizados ou que permitam a reidentificação de seus titulares, a divulgação não poderá ser realizada, de acordo com a LGPD"; os microdados individualizados migraram para acesso controlado (Sedap/Sala Segura) e "os demais produtos que apresentam os resultados das pesquisas à sociedade, que não contêm risco à privacidade dos titulares, seguem sendo divulgados". A transferência de dados pessoais a terceiros é vedada "em circunstância alguma".
4. **Licença formal.** Nenhum dos documentos lidos declara licença de uso, cláusula de atribuição ou restrição de redistribuição para os arquivos de dados. O rodapé do portal gov.br afirma que "todo o conteúdo deste site está publicado sob a licença Creative Commons Atribuição-SemDerivações 3.0 Não Adaptada" (CC BY-ND 3.0): é uma declaração do **site**; o texto não diz se vale para os conjuntos de dados.
5. **Sensibilidade residual.** O RIP e a Nota Técnica nº 5/2021 registram que contagens muito pequenas de categorias pessoais (cor/raça, deficiência, sexo, faixa etária) por escola podem reidentificar e que a solução de longo prazo é sanitização por privacidade diferencial; o INEP, por ora, divulga contagens por escola.

## 3. Classificação por família de dados do Cívica
| Família | Classe | Condições |
|---|---|---|
| Cadastro de escolas (código INEP, nome oficial, município, dependência, situação, localização) | `PUBLIC_DISPLAY_WITH_CONDITIONS` | Citar "INEP, Censo Escolar" e a edição. São dados institucionais de estabelecimentos; o próprio INEP mantém um Catálogo de Escolas público (Manual, §Apresentação). Sem gestor, contato ou endereço. |
| Matrículas e turmas agregadas por município, UF e Brasil (por etapa, dependência, localização) | `PUBLIC_DISPLAY_WITH_CONDITIONS` | Citar a fonte e o ano; rotular números derivados (soma, razão, resto de partição) como cálculo do Cívica; não apresentar como "dado oficial do INEP" o que for derivado; respeitar as regras de aditividade. |
| Matrículas e turmas por etapa, por escola (total, etapas, tempo integral, turno) | `PUBLIC_DISPLAY_WITH_CONDITIONS` | Formato idêntico ao que o INEP já divulga (uma linha por escola); mesma citação e rotulagem. |
| Educação especial por escola (`mat_esp_*`) | `NEEDS_LEGAL_VALIDATION` | Contagem por escola de alunos com deficiência/TEA/altas habilidades é dado sensível quando pequena. **Não habilitar exposição por escola** até haver regra de supressão de células pequenas (1–4) validada; agregados de município, UF e Brasil seguem na classe acima. |
| Tabelas derivadas oferecidas como download/API redistribuível | `NEEDS_LEGAL_VALIDATION` | A cláusula "Sem Derivações" do rodapé do portal, se aplicada aos dados, restringe obras derivadas redistribuídas como se fossem do INEP; exibir indicadores calculados com a fonte citada difere de redistribuir uma "versão adaptada" do arquivo. Decisão jurídica antes da P10.10. |
| Microdados individuais (aluno, docente, gestor) | `RESTRICTED` | Não são publicados no Cívica nem armazenados: o RAW local só tem as tabelas de escola, matrícula (agregada) e turma (agregada); `Tabela_Gestor` e `Tabela_Docente` nunca foram baixadas. |

## 4. Conclusão e encaminhamento
- A exposição **pública do cadastro e dos agregados territoriais** de matrículas e turmas é compatível com o que os documentos oficiais descrevem como uso previsto, **com citação da fonte**.
- **Não habilitar** (registrado para a P10.10): educação especial por escola; download/API de tabelas derivadas; qualquer célula pequena de categorias pessoais.
- Pendências: (i) ler a Nota Técnica nº 12/2023 da ANPD (não está no ZIP) e o TED; (ii) parecer jurídico sobre a cláusula CC BY-ND e redistribuição; (iii) regra de supressão de células pequenas (definida em `CONTRATOS_BENCHMARKS_P102.md`).
- Os dados continuam apenas no PostgreSQL e em read models internos: nenhuma página pública foi criada.
