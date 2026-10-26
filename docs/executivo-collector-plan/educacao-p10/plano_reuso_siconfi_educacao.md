# Plano de reuso do Siconfi para a Educação (função 12) · G7

Estado: **REUSE_WITH_ADAPTATION** · Fase consumidora: P10.5 · Provas: `siconfi_fn12_raw_scan.json`, `siconfi_fn12_raw_x_banco.json`, `siconfi_fn12_invariantes.json`, `reproducibilidade/siconfi_fn12_{raw_scan,invariantes}.py` (somente leitura).

## 1. Respostas
- **O RAW já permite publicar toda a função 12 de 2014–2025? Sim.** Os 28 pacotes × 12 exercícios (`D:\Civica\raw\siconfi\dca\DCA_Anexo_I_E\AAAA\uf*.jsonl.gz`, 260 MB com o RREO) trazem a função 12 e as subfunções 12.122, 12.361, 12.362, 12.363, 12.364, 12.365, 12.366, 12.367, 12.368 e o agregado `FU12 - Demais Subfunções`, por ente e por estágio (empenhada, liquidada, paga, inscrição de RP processados e não processados).
- **Precisa baixar algo novo do Siconfi? Não.** Decisão **B** (reprocessar o RAW) para as subfunções; **A** (só criar indicadores) para o total da função 12, que já está nos fatos publicados.
- **Download novo só seria necessário** para: (i) exercício 2026 do DCA (sai em 2027), (ii) RREO de 2026 depois de outubro, (iii) entes que não responderam e depois respondem.

## 2. Evidência: RAW × banco
| Teste | Resultado |
|---|---|
| Entes com função 12 no RAW | 5.204 (2014) → 5.571 (2024) → 5.530 (2025), de 5.598 entes respondentes/ano (9–374 respostas vazias por ano = `NOT_REPORTED`) |
| Fatos da função 12 já em `exec_fin_fact` (conta 72 = `12 Educação`) | presentes para todos os exercícios 2014–2025 e estágios EMP/LIQ/PAG (+ colunas de RP) |
| **Soma RAW × banco, centavos, 12 exercícios × 3 estágios** | **36/36 idênticas** |
| RREO Anexo 02 (bimestre 6) | `exec_fin_fact` período 6 traz EMP/LIQ ATÉ o bimestre; Vitória 2024: RREO bim. 6 EMP = 805.765.334,24 = DCA EMP (confere) |
| **Invariante Σ subfunções 12.xxx (incl. FU12) = função 12**, por ente × exercício × estágio (tol. R$ 1,00) | **198.497 de 198.536 conferências ok (99,98%)**; 39 divergências em 13 entes de 2017 (ex.: ente 1503093: 3,934 bi × 3,807 bi) → caveat de fonte |
| Peso da função 12 na despesa (EMP, exceto intra) | mediana ≈ 29% (p10 ≈ 20%, p90 ≈ 43–45%), 2019 e 2025 |
- A DCA I-E tem dois blocos ("Despesas Exceto Intraorçamentárias" e "Intraorçamentárias"); a série conferida é a do bloco exceto-intra (como na P9.5).
- O Cívica **persiste hoje**: todas as funções no total + subfunções **só da 06** (`06.122/181/182/183/999`). A subfunção 12.xxx não está no banco, mas está no RAW.

## 3. Estratégias comparadas
| Estratégia | Quando serve | Veredito |
|---|---|---|
| A — só criar indicadores sobre `exec_fin_fact` (conta 72) | totais da função 12 por ente/exercício/estágio | **suficiente para o painel financeiro mínimo**; sem migration de dados novos |
| **B — reprocessar o RAW existente** | subfunções (infantil, fundamental, médio, EJA, especial, superior) e `FU12` | **recomendada**: sem rede; republicação por (UF, exercício) com log |
| C — novo download | só os casos do §1 | **não necessária agora** |

## 4. O que muda no código (P10.5)
1. `packages/db/src/exec/financas-build.ts`: `SEC = '06'` e `SEC_SUB_BY_NAME`/`unknown06` são específicos de Segurança. Generalizar para um conjunto de funções com subfunção retida `{06, 12}` e tabela de rótulos de subfunção de 12 (122, 361–368, `FU12`). Adicionar o invariante "Σ subfunções = função" para 12 (já provado no RAW).
2. `ddl` (nova migration): `exec_fin_cov` tem `fn06 CHECK (0,1)`: acrescentar coluna análoga para função 12 (ou tabela de cobertura por função). **Mudança em tabela usada pela Segurança → teste de regressão obrigatório** (fingerprints P9.7/P9.8 já existem em `scripts/exec/fingerprints-all.ts`).
3. `exec_ref_code`: novos códigos domínio 30 para `12.122/361/362/363/364/365/366/367/368/FU12` (ids novos; ids posicionais são perigosos, ver P9.6: usar `ensureRefCodes`, que só insere o que falta).
4. `specs.ts`/`financas-defs.ts`: indicadores novos (faixa própria, ver arquitetura).
5. Reprocessamento: `npx tsx scripts/exec/financas-pilot.ts publish dca 2014-2025 all` (usa os pacotes RAW já coletados; idempotente; **o hash da fatia muda** porque entram novas linhas, então não será `NO_CHANGE`; os fatos antigos permanecem iguais e o log só registra linhas novas).
6. Backup antes (padrão P9.5): `pg_dump -Fc` em `D:\Civica\backups\pre-educacao-p105-AAAAMMDD.dump`, restauração de teste em cluster `D:\Civica\pgtest_*`.

## 5. Indicadores propostos (P10.5, nomes conceituais)
Por ente e exercício (DCA): despesa **empenhada**, **liquidada**, **paga** na função 12; RP inscritos; participação da função 12 na despesa total do ente; por subfunção (infantil, fundamental, médio, EJA, especial, superior, administração geral); **por habitante** só com população do mesmo ano (sem 2022–2023, sem interpolar) e por matrícula **da rede** (P10.2) com ressalva de que gasto por matrícula não é eficiência. Variação nominal sem deflator (não "crescimento real").

## 6. RREO
- `RREO-Anexo 02` (dotação inicial/atualizada, empenhada/liquidada **até** o bimestre e **no** bimestre) por função/subfunção: RAW em `raw/siconfi/rreo/` (UFs, capitais e entes testados: 786 entes em `exec_fin_cov`, 2015–2026). **Não somar bimestres** (acumulados) e **não misturar com DCA** no mesmo gráfico de exercício sem dizer a fonte; o bimestre 6 reconcilia com a DCA (provado para Vitória/2024).

## 7. Regras
- **Não somar estágios** (empenho, liquidação, pagamento).
- **Não somar snapshots bimestrais** do RREO.
- **Não misturar transferências com gasto final** (Fundeb entra no ente que gasta; a transferência é do Portal/Tesouro).
- **Função 12 ≠ MDE ≠ Fundeb ≠ SIOPE**: função orçamentária contábil (Siconfi) ≠ gasto declarado em MDE (SIOPE, 25%) ≠ recursos do Fundeb. Nenhum dos três substitui os outros; a diferença Vitória/2024 (Siconfi 805,8 mi × SIOPE 873,1 mi) está em `contrato_siope.md`.
- 2022–2023 não têm estimativa oficial de população: indicadores per capita ficam ausentes nesses anos.

## 8. Limitações
- Entes com resposta vazia (9 a 374 por ano) seguem `NOT_REPORTED`; não são zero.
- Divergências de 2017 (13 entes) precisam de marca de caveat na publicação.
- A série RREO é parcial (UFs + capitais + entes selecionados), não os 5.570 municípios.
- Em 2014 a participação da função 12 no total ficou sem amostra na varredura (o rótulo do total difere em exercícios antigos); o parser da P9.5 já resolve o total (`TOT`), então isso afeta só o script de prova.
