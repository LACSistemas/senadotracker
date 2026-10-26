# Privacidade e publicabilidade · P10.3 (G12)

Avaliação **técnica**, não parecer jurídico. Herda e preserva as classificações da P10.2 (`LICENCA_E_USO_DADOS_INEP.md`): cadastro escolar e agregados territoriais = `PUBLIC_DISPLAY_WITH_CONDITIONS`; educação especial por escola e download/API de tabelas derivadas = `NEEDS_LEGAL_VALIDATION`. **Nada da P10.3 foi habilitado em página pública** (sem frontend); o que está abaixo é a classificação para quando as páginas forem construídas.

## 1. O que a P10.3 grava e o que NÃO grava
| Grava | Natureza |
|---|---|
| 100 variáveis institucionais de infraestrutura por escola × edição (`exec_edu_infra_year`) | atributos da **instituição**, autodeclarados |
| 96 medidas dos Indicadores Educacionais oficiais por escola e por território | indicadores **agregados** publicados pelo INEP |
| Docentes distintos oficiais por Brasil, UF e município (Sinopse 2.1/2.2) | contagens **agregadas** |
| **Não grava** | nome, CPF, CNS, registro profissional, data de nascimento, raça/cor, sexo, escolaridade ou vínculo **de pessoa**; `Tabela_Docente`, `Tabela_Gestor`, `QT_PROF_*` (profissionais não docentes), contato e endereço |

Verificado em teste automatizado (`tests/integration/educacao-p103.test.ts`): nenhuma coluna das 7 tabelas novas tem nome de campo pessoal. `Tabela_Docente` e `Tabela_Gestor` não foram baixadas (ver `RELATORIO_EXECUCAO_EDUCACAO_P103.md`, Q18).

## 2. Classificação por família
| Dado | Classe | Condições |
|---|---|---|
| Infraestrutura por escola (serviços, conectividade, ambientes, alimentação, instalações) | `PUBLIC_DISPLAY_WITH_CONDITIONS` | citar INEP e a edição; dizer "declara ter"; mostrar "não informado" e "fora da edição" como estados próprios; sem nota de qualidade |
| **Acessibilidade** por escola (rampas, elevador, sinalização…) | `PUBLIC_DISPLAY_WITH_CONDITIONS` | é atributo do prédio, não de pessoa; manter o rótulo de autodeclaração |
| Agregados de infraestrutura por município, UF e Brasil | `PUBLIC_DISPLAY_WITH_CONDITIONS` | percentual = sim ÷ (sim + não); mostrar o número de escolas do denominador |
| Indicadores oficiais por **escola** (ATU, HAD, DSU, AFD, IED, IRD, ICG) | `PUBLIC_DISPLAY_WITH_CONDITIONS` | os percentuais de formação e esforço de uma escola pequena descrevem poucos docentes: **não** exibir como "o professor X"; rótulo "% dos docentes da escola"; escola com poucos docentes: aviso de pequeno número |
| Indicadores oficiais e docentes por município, UF e Brasil | `PUBLIC_DISPLAY_WITH_CONDITIONS` | sem recalcular; citar a fonte |
| Download/API de tabelas derivadas das planilhas do INEP | `NEEDS_LEGAL_VALIDATION` | herdado da P10.2 (CC BY-ND do portal gov.br; a aplicabilidade à base de dados não está declarada) |
| `Tabela_Docente`, `Tabela_Gestor`, `QT_PROF_*`, remuneração individual (SIOPE) | **proibido** | não coletado, não persistido |

## 3. Reidentificação e pequenos números
- **Escolas com poucos docentes.** AFD, IED e DSU por escola são percentuais sobre um número pequeno de docentes (uma escola rural pode ter 1 a 3). Embora o INEP publique esses valores, o produto deve **suprimir a exibição** (ou exibir "poucos docentes") abaixo de 5 docentes quando o denominador for conhecido. O denominador por escola não está no arquivo do indicador; a regra de interface é: não ranquear escolas por esses percentuais e nunca destacar uma escola de município pequeno como "pior formação".
- **Supressão primária e complementar.** O INEP já usa `--` para suprimido ou não aplicável; o Cívica preserva (NULL) e **não infere** o valor suprimido por subtração (por exemplo, a partir de total menos outras categorias). Os agregados de infraestrutura de município com menos de 3 escolas continuam publicáveis (a unidade é a instituição, não pessoa), mas devem exibir o número de escolas.
- **Cruzamentos.** Cruzar docentes distintos (Sinopse) com atributos de uma escola específica não identifica pessoa: a Sinopse não traz nível de escola.
- **Nota Técnica ANPD nº 12/2023.** Ver §4.

## 4. Nota Técnica nº 12/2023 da ANPD
**O que se confirmou (fonte secundária: compilado das notas técnicas da ANPD de 2023, Mayer Brown, 02/2024; o PDF integral da ANPD não foi lido nesta onda):** a Nota Técnica nº 12/2023/CGF trata do **risco de reidentificação de titulares a partir de dados divulgados publicamente pelo INEP**. Conclusões resumidas: dado anonimizado pode manter alguma chance residual de reidentificação sem que isso, por si só, viole a LGPD; **supressão e generalização** são técnicas de anonimização reconhecidas, com **k-anonimato** sugerido como métrica da eficácia da supressão; controle e registro de acesso a dados pessoais são medidas de segurança; relatórios de impacto devem ser feitos pelo controlador quando o tratamento é de alto risco; e **usar dados públicos aparentemente anônimos para reidentificar titulares não é válido** sob a LGPD. O resumo consultado não diz qual base do INEP foi analisada.

**Implicações efetivas para a P10.3:**
1. A P10.3 **não grava microdado de pessoa**: só atributos da instituição, indicadores agregados oficiais e contagens oficiais. Não há base de pessoas a reidentificar.
2. A prática de supressão do INEP (`--`) é preservada e **não é desfeita** por subtração ou inferência (regra explícita de `CONTRATOS_BENCHMARKS_P103.md`). Cruzar o Cívica com outras bases para identificar docentes ou alunos seria uso vedado.
3. Percentuais de formação, esforço e curso superior de escolas com poucos docentes seguem o raciocínio de pequenos números (k-anonimato): exibição condicionada (ver §3).
4. Fica pendente a leitura do PDF integral da NT e a validação jurídica de (a) redistribuição em massa de tabelas derivadas e (b) exibição de percentuais por escola com denominador pequeno: `NEEDS_LEGAL_VALIDATION`. A conclusão acima **não** é parecer jurídico.

## 5. Regras para o futuro frontend
1. Todo número de infraestrutura leva "declarado pela escola" e a edição; nenhum selo de qualidade.
2. "Não informado" e "fora da edição" são estados visíveis, nunca "não".
3. Docentes: "docentes distintos" para território, "função docente" onde a fonte diz função; nunca somar escolas, etapas ou redes.
4. Escola com poucos docentes: ocultar percentuais de formação/esforço ou avisar.
5. Sem lista de professores, sem comparação entre pessoas, sem ranking de escolas por infraestrutura entre etapas diferentes.
