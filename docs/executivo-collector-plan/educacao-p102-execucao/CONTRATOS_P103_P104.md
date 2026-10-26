# Contratos para P10.3 e P10.4 · sobre a oferta publicada (G15)

O que as próximas ondas encontram **pronto** e o que ainda precisam fazer. Fontes e layouts de infraestrutura, docentes, Ideb e Saeb: `docs/executivo-collector-plan/educacao-p10/contrato_infraestrutura_docentes.md` e `contrato_aprendizagem_ideb_saeb.md` (investigação P10, não reaberta).

## 1. Chaves e tabelas disponíveis (P10.1 + P10.2)
| Item | Onde | Garantia medida |
|---|---|---|
| Identidade da escola | `exec_edu_school.inep` | 299.547 códigos; FK de qualquer tabela nova |
| Escola × edição, com município, dependência, localização, situação | `exec_edu_school_year (inep, year)` | 4.272.656 linhas; 19 edições |
| Matrículas, turmas e oferta por escola × edição | `exec_edu_offer_year (inep, year)` | uma linha por escola do universo (matrícula ou turma > 0); FK composta para o cadastro; `NULL` ≠ 0 |
| Somas por UF × dependência × localização | `exec_edu_offer_agg` | série de UF e Brasil sem varrer escolas |
| Cobertura | `exec_edu_offer_cov`, `exec_edu_cov` | 513 fatias cada; bit0 ⇔ oferta com matrícula: 513/513 |
| Publicação | datasets 70 (cadastro) e 71 (oferta), competência `ano × 100 + 5` | `NO_CHANGE`, retificação com log, rollback exato |
| Leitura | `getEducationNationalOffer`, `getEducationStateOffer`, `getEducationMunicipalityOffer`, `getEducationSchoolOffer` (+ as quatro funções do cadastro da P10.1) | pontos de extensão `extensions: {}` |
| RAW | `D:\Civica\raw\inep\censo_escolar\AAAA\` (2007–2024: ZIP; 2025: `Tabela_Escola`, `Tabela_Matricula`, `Tabela_Turma`) e `raw/inep/docs/2025/` | manifesto com SHA-256; **não rebaixar** |
| Extratores | `scripts/exec/censo_escola_extract.py` (cadastro), `censo_oferta_extract.py` (oferta) | whitelist; cada onda amplia a **sua** whitelist |
| Ids livres | dataset ≥ 72, `table_id` ≥ 86, migration v11 | ver `specs.ts` |

## 2. P10.3 · Infraestrutura e docentes: o que já pode usar direto
1. **Universo de escolas por etapa (denominador).** "Escolas que oferecem a etapa X" = linhas de `exec_edu_offer_year` com `mat_x > 0` (já devolvido em `stages[].escolas` do município). Qualquer percentual de infraestrutura (ex.: "% das escolas com biblioteca") usa como denominador o universo da edição, **não** o cadastro completo (que inclui escolas paralisadas e extintas).
2. **Denominadores de matrícula e turma** para razões (alunos por turma oficial, alunos por docente quando houver docente único oficial): `exec_edu_offer_year` e `exec_edu_offer_agg`.
3. **Mesma chave e mesma regra de ausência.** A tabela de infraestrutura entra como `exec_edu_school_infra_year (inep, year, …)` com FK para `exec_edu_school_year`; `NULL` = a edição não tem a variável (a quebra de 2019 está em `censo_escolar_variaveis_x_ano.csv`), vazio ≠ "não", nunca zero.
4. **Fatia e publicação:** dataset novo (≥ 72), fatia UF × edição, `bootstrap` na primeira publicação; usar `verify` para cruzar a nova tabela com `exec_edu_offer_year` (escola sem oferta não pode ter infraestrutura "ativa").
5. **Docentes:** `QT_DOC_*` por escola **não soma** entre escolas (superconta ≈ 22%): totais territoriais só dos níveis oficiais; razão aluno/docente só com docente único oficial. `Tabela_Docente` e `Tabela_Gestor` seguem fora até a decisão da P10.3 (privacidade).
6. **Tamanho de turma oficial** (ATU) vem dos Indicadores Educacionais do INEP (P10.3): comparar com o `matPorTurma` derivado da P10.2 é a primeira verificação cruzada da onda.

## 3. P10.4 · Ideb, Saeb e rendimento: o que já pode usar direto
1. **Chave e edição.** Ideb/Saeb por escola chegam com o mesmo `inep`; o ano do Ideb usa o Censo do **mesmo ano**: junte `(inep, year)` a `exec_edu_school_year` e `exec_edu_offer_year`.
2. **Etapas do Ideb = partições da P10.2.** Anos iniciais = `mat_fund_ai`, anos finais = `mat_fund_af`, ensino médio = `mat_med`. O universo "escola com anos iniciais" é `mat_fund_ai > 0` na edição; o Ideb só existe para escolas que atendem o critério de participação do INEP (não inferir).
3. **Rede.** Dependência em `exec_edu_school_year.dep` (a da edição); o Ideb de rede (município, UF, Brasil) vem pronto do INEP e **nunca** se calcula como média das escolas (regra da P10).
4. **Pesos e cobertura.** Matrícula da etapa (`mat_fund_ai` etc.) é o peso para descrever cobertura (quantas matrículas estão em escolas com Ideb), nunca para recalcular o Ideb.
5. **Histórico escolar:** a série de matrícula por escola (`getEducationSchoolOffer`) acompanha cada ponto do Ideb; a mudança de dependência/município de uma escola entre edições já está no cadastro (`getEducationSchoolHistory`).
6. **Migration e dataset:** v11 (`exec_edu_school_indicator`, estreita) com FK para `exec_edu_school`; decisão do dono sobre o escopo (5,5 mi / 18 mi / 80 mi de linhas) continua pendente.

## 4. Orçamento restante
P10.1 + P10.2 consumiram o descrito em `CUSTO_REAL_ARMAZENAMENTO_P102.md`; a meta de 5 GB para P10.1–P10.3 continua viável com folga (a P10.3, com 25–30 colunas pequenas por escola × edição, deve custar o mesmo que a oferta).

## 5. O que fica FORA da P10.2 (e não deve ser antecipado)
Infraestrutura, docentes, gestores, Ideb, Saeb, rendimento, programas do FNDE, obras, contratos, ensino superior e frontend.
