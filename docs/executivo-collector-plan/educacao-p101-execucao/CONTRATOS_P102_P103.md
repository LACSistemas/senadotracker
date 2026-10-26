# Contratos para P10.2 e P10.3 · sobre o cadastro publicado (G15)

O que as próximas ondas encontram **já pronto** e o que ainda precisam fazer. Fonte e layouts de matrículas/turmas/infraestrutura/docentes: `docs/executivo-collector-plan/educacao-p10/contrato_matriculas_turmas.md` e `contrato_infraestrutura_docentes.md` (investigação P10, não reaberta).

## 1. O que a P10.1 entrega às duas ondas

| Item | Onde | Garantia |
|---|---|---|
| Chave da escola | `exec_edu_school.inep` (integer, 8 dígitos, 11.000.023–53.088.034) | única, estável, 299.547 códigos; 100% dos códigos de 2025 começam pelo código IBGE da UF do município registrado |
| Escola × edição | `exec_edu_school_year (inep, year)` | 1 registro por escola e edição, 2007–2025, 4.272.656 linhas |
| Município da edição | `exec_edu_school_year.entity_id → exec_entity` | sempre existente; UF por `exec_entity.uf_code` |
| Dependência, localização, situação | colunas `dep`, `loc`, `sit` | domínios fechados por `CHECK` |
| Sinal de matrícula | `flags` bit0 = `QT_MAT_BAS > 0`; bit1 = recorte da Sinopse | exato contra a Sinopse em 19 edições |
| Cobertura | `exec_edu_cov (year, uf)` | contagens por edição × UF; a P10.2 reconcilia suas somas contra `with_mat` e `univ` |
| Publicação | `DATASET.edu_censo = 70`, fatia UF × competência `ano*100+5`, `publishSlice` | transacional, `NO_CHANGE`, retificação com log, rollback exato |
| Leitura | `getEducationSchool`, `…SchoolHistory`, `…MunicipalitySchools`, `…StateSchools` | paginação real; `extensions: {}` marca onde as ondas se encaixam |
| RAW | `D:\Civica\raw\inep\censo_escolar\AAAA\` (2007–2024: ZIP inteiro; 2025: `Tabela_Escola` e `Tabela_Matricula`) | manifesto com SHA-256 em `exec_raw_manifest`; **não rebaixar** |
| Extração | `scripts/exec/censo_escola_extract.py` (whitelist de 8 colunas) | a P10.2 amplia a whitelist **por onda** (nunca "todas as colunas") |

## 2. P10.2 (matrículas, turmas, oferta, etapas, modalidades) pode começar sem nova investigação

1. Migration **v10**: `exec_edu_school_offer_year (inep integer REFERENCES exec_edu_school, year smallint, …)`, PK `(inep, year)`, colunas inteiras: `QT_MAT_BAS`, matrícula por etapa (infantil, fundamental AI/AF, médio, profissional, EJA, especial), `QT_TUR_*`, flags de oferta `IN_COMUM_*`, `IN_EJA`, `IN_PROFISSIONALIZANTE`, `IN_ESPECIAL_EXCLUSIVA`. Colunas por layout: 2007–2024 no CSV único (a coluna existe em todas as edições lidas); 2025 em `Tabela_Matricula`/`Tabela_Turma` (**baixar `Tabela_Turma` por Range**; `Docente` e `Gestor` continuam fora).
2. Reconciliação pronta: `Σ escolas = município = UF = Brasil = Sinopse 1.x` (2025: 46.018.380 já provado na P10); o bit0 de `flags` já existe e deve ser igual a `QT_MAT_BAS > 0` na nova tabela (teste de consistência cruzada).
3. Regras: matrícula ≠ aluno único; etapas aditivas separadas das não aditivas; rede municipal ≠ escolas localizadas.
4. Fatias: reutilizar `edu_censo` (mesma fatia UF × edição) ou um dataset irmão (`edu_oferta = 71`) com `table_id` ≥ 83.

## 3. P10.3 (infraestrutura e docentes) já reutiliza diretamente

- **Cadastro**: o mesmo par `(inep, year)` e `exec_edu_cov` para cobertura; a tabela `exec_edu_school_infra_year` referencia `exec_edu_school`.
- **Quebra de 2019**: 2007–2018 e 2019+ têm famílias de variáveis de infraestrutura diferentes (`censo_escolar_variaveis_x_ano.csv`): campos inexistentes na edição ficam `NULL` com semântica "não disponível", nunca 0; vazio = não informado.
- **Docentes**: `QT_DOC_*` por escola **não soma** entre escolas (superconta ≈ 22% no total nacional): totais territoriais só dos níveis oficiais do INEP.
- **Privacidade**: sem `Tabela_Gestor`; supressão de células pequenas conforme `contrato_privacidade_educacao.md`.

## 4. O que ainda é decisão do dono (fora da P10.1)

- Escopo dos indicadores por escola (P10.4) e a retenção do `exec_change_log` (não aplicada).
- Exibir nome de escola individual em páginas públicas (os dados são públicos; a decisão é de produto).
