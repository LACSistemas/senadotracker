# Contratos de benchmark da Educação · G13

Estado: **PASS_WITH_CAVEATS → `CLEAR_TO_IMPLEMENT` para os 6 benchmarks marcados "defensável"**; os demais `NEEDS_VALIDATION`. Fase consumidora: P10.9 (e P10.10). Reaproveita o motor de benchmark da Segurança (`packages/db/src/exec/security-bench.ts`, `apps/web/lib/security/bench.ts`): grupo comparável, mínimo de 5, cobertura ≥ 80%, supressão invalida, população do mesmo ano, **sem ranking**, frase com faixa central (1º–3º quartil).

## 1. Regra de ouro
Só há comparação quando: **mesma fonte, mesmo indicador, mesma unidade, mesma etapa, mesma edição/ano, mesma rede (dependência), denominador oficial do mesmo ano, cobertura suficiente e supressão tratada.** Senão a interface diz "sem comparação válida" e o motivo.

## 2. Benchmarks (o que é defensável)
| # | Comparação | Dado | Grupo comparável | Veredito |
|---|---|---|---|---|
| B1 | **Ideb da rede municipal × mediana das redes municipais da mesma UF**, mesma etapa e edição | linha `Municipal` do arquivo oficial (não média de escolas) | municípios da UF com Ideb válido: 5.320 redes municipais com Ideb AI 2025 (130 sem); **mínimo por UF = 15 (RR)**, 16 (AP), 22 (AC), 50 (RO); DF não tem rede municipal → só UF × Brasil | **defensável** |
| B2 | **Ideb da escola × mediana das escolas da mesma etapa, edição, dependência e localização** (UF ou município como recorte) | `VL_OBSERVADO_AAAA` por escola | escolas com Ideb válido no mesmo recorte; mínimo 5 | **defensável** (escola sem Ideb: "não divulgado") |
| B3 | **UF × Brasil** (Ideb, rendimento, TDI, ATU, AFD…) | linhas oficiais Brasil e UF (rede Total/Pública/Estadual/Municipal/Privada) | UF × Brasil, mesma rede | **defensável** (existe linha oficial; não é cálculo nosso) |
| B4 | **Evolução própria** de matrículas por etapa/dependência | Censo, escola e município | o próprio território, anos publicados | **defensável**; marcar a quebra 2019 (infra) e lacunas |
| B5 | **% de escolas com internet/biblioteca/água… × mediana de municípios do mesmo porte (nº de escolas da rede) na UF** | `IN_*` do Censo, denominador = escolas **em atividade** da mesma dependência/ano | grupo ≥ 5 | **defensável**, "declara ter" (G5) |
| B6 | **Taxa de abandono/aprovação/distorção** por etapa × municípios da UF (rede) | arquivos oficiais `tx_rend_*`, `TDI_*` | mesma etapa/rede/ano | **defensável** |
| B7 | **Gasto (função 12 ou SIOPE) por matrícula da rede** × municípios do mesmo porte | Siconfi/SIOPE do ente ÷ matrículas **da rede mantida pelo ente** (Censo, mesmo ano) | municípios (rede municipal); Estado só com Estados | `NEEDS_VALIDATION`: depende de P10.2 e de o denominador ser "matrícula da rede do ente" (não de todas as escolas localizadas) e de 2022–2023 sem população; "por matrícula" ≠ eficiência |
| B8 | **Escolas rurais × urbanas** | `TP_LOCALIZACAO` | mesma rede/etapa | defensável só como recorte descritivo; sem "diferença de qualidade" |
| B9 | **Docentes com formação adequada** (AFD oficial) | grupos AFD por etapa | mesmo grupo/etapa | defensável com os grupos oficiais; não recalcular |
| B10 | **Redes municipais do mesmo estado** | = B1 | | defensável |

## 3. Comparações enganosas (proibidas)
| Proibido | Por quê / guarda |
|---|---|
| Ideb de etapas diferentes (AI × AF × EM) | escalas e populações distintas; o comparador exige `etapa` igual |
| Escolas sem considerar etapa avaliada, dependência e localização | idem; B2 só nesses recortes |
| Média das escolas × Ideb oficial da rede | a rede tem metodologia própria (N×P agregado); nunca `AVG(Ideb escolas)` |
| Gasto total sem tamanho do sistema para inferir eficiência | só gasto por matrícula, com ressalva "não mede eficiência" |
| Correlação como causalidade (gasto × Ideb) | sem gráfico de dispersão que sugira causa; texto neutro |
| Ausência como zero | "-" do Ideb = não divulgado; vazio do Censo = não informado |
| Rede municipal × todas as escolas localizadas no município | escola localizada ≠ escola administrada pelo município (`TP_DEPENDENCIA`) |
| Município × Brasil em indicador de rede municipal | Brasil não tem "rede municipal agregada" comparável sem a linha oficial |
| Docentes: somar escolas para obter município | docente conta uma vez por agregação (G5) |
| Taxa por habitante/idade em 2022–2023 | sem estimativa oficial; sem interpolar |
| Matrícula = alunos | matrícula ≠ aluno (G4) |
| SIOPE × Siconfi somados ou por subfunção | universos diferentes (G8) |

## 4. Parâmetros de implementação (herdados e novos)
- Mínimo de 5 unidades no grupo; cobertura ≥ 80% do universo do grupo; supressão (célula pequena) invalida o benchmark; frase "Entre N {redes} … mediana … {território} … abaixo/dentro/acima da faixa central".
- **Porte** para benchmarks de rede: nº de matrículas da rede (faixas definidas na P10.9); para B5 nº de escolas em atividade da rede. Não usar população total como porte de rede escolar.
- Exceções de grupo pequeno (grupos com poucos municípios, como RR, AP, AC, DF): cair para o recorte UF **sem faixa de porte**, com o rótulo do grupo.
- Cada benchmark é uma função pura com `status ∈ {ok, grupo_pequeno, cobertura_insuficiente, etapa_incompativel, sem_denominador_do_ano, celulas_suprimidas}`.

## 5. Limitações
- Distribuição do Ideb por UF medida só para anos iniciais 2025; AF/EM e escolas não medidos.
- B7 depende de P10.2 (denominador) e do tratamento dos dois gastos (Siconfi × SIOPE).
- Faixas de porte de rede escolar não calibradas (só o princípio).
