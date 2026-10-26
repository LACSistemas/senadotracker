# Taxonomia e precisão da classificação (G2_EDUCATION_CLASSIFICATION)

**Resultado: PASS_WITH_CAVEATS.** A classificação é determinística, versionada (`edu-ctr-v7`), e cada contrato guarda categoria, eixo, regra, confiança e trecho de evidência (`exec_edu_contract_class`).

## Dois eixos que nunca se fundem
1. **Comprador** (quem contrata): secretaria, fundo, departamento ou unidade escolar de educação, FDE, Colégio Pedro II; MEC/FNDE/INEP pelo nome exato = `CONFIRMED_OFFICIAL`.
2. **Objeto** (o que compra): categorias 1 a 15 por palavra-chave **com contexto escolar**. Palavra genérica (computador, obra, limpeza) nunca basta. Categoria 16 = contratação de órgão de educação sem tema identificado.

Estados: `CONFIRMED_OFFICIAL` (2.827), `HIGH_CONFIDENCE_DERIVED` (380.883), `POSSIBLE_EDUCATION` (44.482, sempre separado dos totais), `NOT_EDUCATION` e `UNCLASSIFIED` (não persistidos).

Categorias: 1 construção; 2 reforma/ampliação; 3 manutenção predial; 4 mobiliário; 5 material pedagógico; 6 tecnologia; 7 conectividade; 8 alimentação; 9 transporte; 10 material didático; 11 uniformes; 12 serviços educacionais; 13 limpeza/vigilância/terceirização; 14 infraestrutura esportiva; 15 acessibilidade; 16 sem tema.

Exclusões: ensino superior, escola de governo/magistratura, hospital-escola, ensino militar/forças armadas, tribunais/câmaras sem unidade escolar nomeada, compradores de saúde/assistência/obras sem contexto escolar, objeto para vários setores (rebaixado a POSSIBLE).

## Precisão medida (revisão manual item a item, semente fixa 20261026)
Revisor: o próprio assistente, **sem segundo revisor humano**. Veredictos persistidos em `exec_edu_contract_audit` (1.260 itens) e em `evidencias/auditoria_veredictos_v6.json`; cálculo em `evidencias/auditoria_estatisticas.json`.

| Faixa | n revisado | Não educacional | Precisão | IC 95% | Categoria primária correta |
|---|---|---|---|---|---|
| Obras (cat. 1–2) | 110 | 3 | 97,2% | 92,2–99,1 | 96,2% |
| Manutenção/terceirização (3, 13) | 110 | 6 | 94,5% | 88,6–97,5 | 96,2% |
| Alimentação (8) | 110 | 2 | 98,2% | 93,6–99,5 | 100% |
| Transporte (9) | 70 | 3 | 95,7% | 88,1–98,5 | 100% |
| Equipamentos/tecnologia (4–7, 14, 15) | 70 | 1 | 98,6% | 92,2–99,7 | 97,1% |
| Didático/uniforme/serviço (10–12) | 70 | 2 | 97,1% | 90,0–99,2 | 95,5% |
| Institucional sem tema (16) | 70 | 1 | 98,6% | 92,3–99,7 | n/a |
| **Estratificado (alta confiança, 384.357)** | 600 | | **97,9%** | | **99,1%** (98,6% sem a faixa 16) |

- `CONFIRMED_OFFICIAL`: identidade do comprador exata por nome (MEC, FNDE, INEP e Colégio Pedro II). Não mede se o **objeto** é pedagógico: a maioria é gasto administrativo do órgão.
- `POSSIBLE_EDUCATION` (n=70): 26 educacionais, 18 não, 26 indeterminados → precisão entre 37% e 74%. Não use em total.
- Delta das últimas regras (contratos incluídos depois da amostra principal): 150 + 100 revisados, 1 não educacional; categoria 16 genérica em obras de escolas da FDE (a categoria 2/3 seria mais precisa).

## Falsos positivos e negativos conhecidos (sem inventar recall nacional)
- Falsos positivos típicos: centros de instrução militar com "alunos", contratos de saúde com "material didático", compras para "vários setores" com escola citada.
- **Falsos negativos**: entre contratos que citam "escola/escolar" e não foram classificados, ~7–8% eram educacionais (8/110 e ~17/220 em duas amostras; população 11.581 → ~900 contratos). Causa: adjetivo "escolar" sem unidade escolar nomeada e sem comprador de educação (decisão de precisão). Entre negativos aleatórios, 3/220 (1,4%, IC 0,5–3,9%) eram educacionais antes dos últimos ajustes (FDE, Colégio Pedro II, material didático); a amostra foi usada para ajustar regras, então o resto **não é estimativa fora da amostra**. Recall nacional não é afirmado.
- Valores: contratos acima de R$ 10 bi (6 casos) ficam marcados `outlier` e fora das somas; valor negativo na origem vira NULL; contrato sem valor entra na contagem.
