# Contrato de docentes · P10.3 (G5)

Estado: **PASS**. Define o que o Cívica sabe, guarda e mostra sobre docentes, e o que **nunca** faz.

## 1. Quatro unidades diferentes (não se misturam)
| Unidade | Definição | Onde está no Cívica | Aditividade |
|---|---|---|---|
| **Docentes distintos** | pessoas contadas **uma vez em cada nível de agregação** (Brasil, UF, município) e em cada coluna da tabela | `exec_edu_doc_terr` (Sinopse 2.1/2.2), 2007–2025 | **não** somam entre níveis, etapas, redes nem localizações |
| **Funções docentes** | vínculos/funções (um docente em duas escolas tem duas funções) | só onde a fonte diz "função": **DSU** (% de funções docentes com curso superior) | a fonte define a base do percentual |
| **Docentes por escola** | contagem no âmbito da escola (`QT_DOC_BAS` etc.) | **não gravado** | não somam entre escolas (superconta ≈ 22–24%) |
| **Docentes por etapa** | podem se sobrepor quando o mesmo professor atua em mais de uma etapa | colunas de etapa da Sinopse (`doc_inf`, `doc_fun`…) | soma das etapas ≥ total |

## 2. O que o Cívica publica
1. **Total oficial** por Brasil, UF e município e por etapa, rede e localização (15 colunas, `DOC_LABELS`), com a nota "docentes distintos".
2. **Indicadores oficiais do INEP**, por escola e por território, lidos prontos: DSU (curso superior), AFD (adequação da formação, grupos 1–5), IED (esforço, níveis 1–6), IRD (regularidade), ATU (alunos por turma), HAD (horas-aula), ICG (complexidade de gestão).
3. Para a escola, **somente** os indicadores oficiais; nenhuma contagem derivada.

## 2.1 Perguntas da especificação
| Pergunta | Resposta |
|---|---|
| Quantos docentes são oficialmente contabilizados? | **2.407.049** docentes distintos em 2025 (Sinopse 2.1), 1.878.284 em 2007 |
| Quantas funções docentes existem? | nas tabelas 2.1 e 2.2 da Sinopse lidas não há total de funções docentes; só o DSU usa a base "função docente". O Cívica não estima. |
| Formação superior | DSU (2011+) por escola, município, UF e Brasil, total e por etapa |
| Formação adequada à disciplina | AFD (2013+), grupo 1 = adequada |
| Esforço docente | IED (2013+), níveis 1–6 |
| Regularidade | IRD (2013+) |
| Evolução e diferenças entre redes/etapas/territórios | séries por família nas tabelas `exec_edu_ind_*`; recortes dependência × localização nos arquivos territoriais |

## 3. Proibições (testadas)
- Somar `QT_DOC_*` das escolas para obter docentes de município, UF ou Brasil.
- Aplicar coeficiente de correção (a diferença medida entre a soma das escolas e os distintos **não** é fator universal).
- Somar etapas ou redes para obter o total (2025: pública + privada = 2.482.688 > 2.407.049).
- Média de percentuais de escolas para obter o percentual do município (usa-se o valor oficial municipal).
- Gravar nome, CPF, CNS, registro profissional, vínculo individual ou lista de professores. `Tabela_Docente` **não foi baixada**; só entraram as planilhas agregadas.
- Inferir identidade ou valor suprimido (`--`) por subtração.

## 4. Fonte, versão e reprodução
Sinopse Estatística da Educação Básica de cada edição (xlsx oficial copiado por Range para staging; só as tabelas 2.1 e 2.2 são extraídas e a planilha é apagada). O TSV derivado fica em `D:\Civica\raw\inep\sinopse_docentes\` com o SHA-256 da planilha de origem no manifesto. Scripts: `reproducibilidade/sinopse_docentes_batch.sh`, `scripts/exec/sinopse_docentes_tsv.py`, `apps/collector/src/exec/educacao-doc.ts`.
