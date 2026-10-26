# Contratos de dados: Ideb, Saeb, rendimento, distorção, transição e INSE (P10.4)

Valem para o que está implementado em `packages/db/src/exec/` (`educacao-learn-*`, `educacao-flow-*`, `educacao-inse-build.ts`, `ddl-v13.ts`) e `apps/collector/src/exec/` (`educacao-learn.ts`, `educacao-flow.ts`). Toda mudança de regra exige subir a versão do parser (`IDEB_VERSION`, `SAEB_VERSION`, `FLOW_VERSION`, `INSE_VERSION`).

## 1. Fontes e arquivos (RAW em `D:\Civica\raw\inep\`, nada em `data/`)

| Família | Fonte oficial (INEP) | Arquivos | Edições | Garantia |
|---|---|---|---|---|
| Ideb | Resultados do Ideb, divulgação 2025 | `ideb/2025/`: Brasil, regiões+UFs, municípios (3 etapas), escolas (3 etapas), `nota_informativa_ideb_2025.pdf` | 2005, 2007, …, 2025 (todas no mesmo arquivo largo) | SHA-256 no manifesto; CRC dos ZIPs conferido |
| Saeb | Resultados agregados do Saeb | `saeb/`: 2017 (ZIP, 4 xlsx), 2019 (xlsx), 2021 (xlsx + planilha com taxa de alfabetização), 2023 (RAR com `.xlsb`), 2025 (xlsx) + notas técnicas | 2017, 2019, 2021, 2023, 2025 | Sem microdados de aluno em nenhum momento |
| Rendimento (TXR) | Indicadores Educacionais: taxas de rendimento | `indicadores/arquivos/`: escolas, municípios, Brasil+regiões+UFs | 2007–2025 | 61 arquivos, 1,6 GB |
| Distorção idade-série (TDI) | Indicadores Educacionais | idem | 2006–2025 (escola e município de 2007) | 55 arquivos, 0,7 GB |
| Transição (TRN) | Indicadores Educacionais: taxas de transição | municípios, Brasil+regiões+UFs (não existe por escola) | 2007/2008 a 2021/2022 (15 pares) | 30 arquivos, 0,27 GB |
| INSE | Indicador de Nível Socioeconômico do Saeb | `INSE_{2019,2021,2023}_{escolas,municipios,estados,brasil}.xlsx` | 2019, 2021, 2023 | 11 arquivos, 51 MB |

No manifesto estão 174 arquivos (2,97 GB). Não há arquivo de Saeb por escola em nenhuma edição: a nota do Saeb por escola só existe como componente do Ideb (`nota_mt`, `nota_lp`, `nota_media`). O INSE de 2011–2015 (`Indicador_INSE_por_Escola.zip`, `Indicador_Inse_2015.zip`) foi baixado e **não foi carregado**: outra metodologia, sem escala comparável com 2019–2023 (ver `COMPARABILIDADE_APRENDIZAGEM.md`).

## 2. O que o valor significa (vinculante)

1. **Ideb = N × P.** `nota_media` é N (0–10, padronizada a partir das proficiências do Saeb), `p` é o indicador de rendimento (0–1, média harmônica das aprovações por série), `ideb` é o resultado arredondado a uma casa. `nota_mt` e `nota_lp` são as proficiências na escala do Saeb (0–500), **não** são o Ideb. O Ideb de escola, rede, município, UF, região e Brasil é o da própria linha do arquivo: **nunca a média dos Idebs das escolas** (a Nota Informativa do Ideb 2025 traz o exemplo e `RECONCILIACAO_APRENDIZAGEM.md` mede a diferença em 8 municípios).
2. **Etapas não se misturam.** 1 = anos iniciais (1º ao 5º ano), 2 = anos finais (6º ao 9º), 3 = ensino médio. As aprovações por série de cada etapa são `ap_1..ap_5` (AI: 1º–5º; AF: 6º–9º nas posições 1–4; EM: 1ª–4ª série) e `ap_tot` é a taxa de aprovação da etapa.
3. **Rede.** Esquema único em todo o schema: 0 total, 1 federal, 2 estadual, 3 municipal, 4 privada, 5 pública (federal+estadual+municipal), 6 estadual+municipal. As planilhas do INSE numeram 5 e 6 ao contrário; a conversão é feita na leitura. O Saeb tem três linhas "Total - …" (todas as redes = 0, federal+estadual+municipal = 5, estadual+municipal = 6) que **não** podem colidir.
4. **Ausência.** `-`, `--` e vazio são NULL (não divulgado, não se aplica, participação insuficiente). `***` é o sigilo estatístico do INEP: NULL e contado em `cells_supp`. **Nunca zero e nunca reconstruído.** Zero publicado é zero. Exceções documentadas: (a) no Saeb de UF e Brasil de 2017 o INEP grava média 0 e distribuição toda 0 para estrato sem alunos: é marcador, vira ausente e é contado em `emptyStrata`; (b) INSE com `qtd = 0` e média 0 é "não calculado": média NULL.
5. **Meta.** Só existe de 2007 a 2021 (ciclo de metas de 2007). As edições 2023 e 2025 não têm meta mas, segundo a Nota Informativa do Ideb 2025, são comparáveis às anteriores.
6. **Escola.** A identidade vem do cadastro da P10.1 (`exec_edu_school`). Escola do arquivo que não está no cadastro 2007–2025 **não é criada nem ganha snapshot inventado**: é rejeitada com `SEM_IDENTIDADE_ESCOLAR` e contada (124 códigos distintos no Ideb, ausentes do cadastro 2007–2025, provavelmente escolas extintas antes de 2007; 137 linhas por edição de 2005 a 2021, nenhuma em 2023–2025). A chave estrangeira é para a identidade (`exec_edu_school`), **não** para `exec_edu_school_year`: o contrato anterior sugeria a chave composta, mas o Ideb de 2005 e as taxas de escolas que mudaram de situação precisam existir sem linha na edição do cadastro.
7. **Município pequeno / rede com poucas escolas.** O INEP não divulga resultado de escola com participação abaixo de 80% (Portaria 435/2025), de município abaixo de 50% nem de município com uma só escola abaixo de 80%. A ausência não é resultado baixo.
8. **Transição.** O arquivo "Y/Y+1" descreve a mudança do Censo Y para o Censo Y+1 e é gravado com `year = Y`. Existe só para município, UF, região e Brasil.
9. **Distorção** é o percentual de matrículas com 2 anos ou mais de atraso em relação à idade recomendada da série. Não é rendimento e não entra na conta de 100%.
10. **Privacidade.** Só agregados oficiais por escola, município, UF e Brasil. Nenhuma tabela tem coluna de aluno, professor, gestor, nome de pessoa, CPF, e-mail ou telefone (teste de colunas em `tests/integration/educacao-p104.test.ts`).

## 3. Chaves, tabelas e escalas (migration v13, 13 tabelas)

| Tabela | Chave primária | Escala de gravação | Linhas (produção) |
|---|---|---|---|
| `exec_edu_ideb_school` | (inep, year, stage) | `double precision`, valores como publicados | 1.045.501 |
| `exec_edu_ideb_terr` | (year, entity_id, stage, dep) | idem | 359.746 |
| `exec_edu_saeb_terr` | (year, entity_id, dep, loc, cap, grade, subj) | média ×100 (integer); níveis e alfabetização ×100 (smallint) | 1.820.574 |
| `exec_edu_flow_school` | (inep, year) | percentual ×100 (smallint), 71 medidas | 2.678.764 |
| `exec_edu_flow_terr` | (year, entity_id, loc, dep) | idem | 1.258.400 |
| `exec_edu_trn_terr` | (year, entity_id, loc, dep) | idem, 64 medidas | 360.304 |
| `exec_edu_inse_school` | (inep, year) | média ×10000 (integer), níveis ×100 | 208.444 |
| `exec_edu_inse_terr` | (year, entity_id, dep, loc, cap) | idem | 229.392 |
| `exec_edu_{ideb,saeb,flow,trn,inse}_cov` | (year, uf, family, lvl) | contagens | 605 / 122 / 2.008 / 420 / 164 |

Conferências de precisão: nenhuma célula perde casas decimais (`lossy = 0` nas 5 famílias; Saeb e INSE conferidos célula a célula, a média do INSE precisou de 4 casas por causa dos municípios). A cobertura (`*_cov`) guarda, por edição × UF × nível, linhas lidas, válidas, rejeitadas, escolas sem identidade, células publicadas e células suprimidas.

## 4. Publicação

Dataset 75 (Ideb), 76 (Saeb), 77 (rendimento + distorção), 78 (transição), 79 (INSE); fatia = edição × UF (`uf = 0` é a fatia nacional com Brasil e regiões); competência `edição × 100 + 5`. `publishSlice` do Modelo D: primeira carga sem change log (`bootstrap`), reexecução idêntica `NO_CHANGE`, retificação com change log, `rollbackRun` e `replayFrom`. A impressão digital da fatia inclui os SHA-256 dos arquivos de origem e a versão do parser.

## 5. Rejeições possíveis (todas classificadas, nenhuma corrige o dado)

Ideb: `INEP_INVALIDO`, `SEM_IDENTIDADE_ESCOLAR`, `MUNICIPIO_INEXISTENTE`, `TERRITORIO_INEXISTENTE`, `UF_INEXISTENTE`, `REDE_INVALIDA`, `VALOR_INVALIDO`, `VALOR_FORA_DE_FAIXA`, `CHAVE_DUPLICADA`. Saeb: `TERRITORIO_INEXISTENTE`, `REDE_INVALIDA`, `DISCIPLINA_INVALIDA`, `VALOR_INVALIDO`, `VALOR_FORA_DE_FAIXA`, `CHAVE_DUPLICADA`. Fluxo e INSE: as de escola/território acima mais `LOCALIZACAO_INVALIDA`. Repetição **idêntica** de linha (arquivo municipal do INSE 2023, planilha de alfabetização do Saeb 2021) vale uma só e é contada; valor diferente na mesma chave é `CHAVE_DUPLICADA`.
