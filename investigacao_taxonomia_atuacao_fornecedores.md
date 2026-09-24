# Investigação — taxonomia editorial de atuação de fornecedores

**Escopo:** contratos institucionais da Câmara e do Senado, itens institucionais disponíveis e despesas parlamentares CEAP/CEAPS. Esta é uma investigação; nenhuma classificação foi persistida e nenhuma regra foi adicionada ao collector.

## O que existe na base

| Universo/tabela | Registros | Texto principal | Cobertura observada |
|---|---:|---|---:|
| Contratos Câmara | 2.181 | `institutional_contracts.object` | 2.181/2.181 (100%) |
| Contratos Senado | 2.626 | `institutional_contracts.object` | 2.626/2.626 (100%) |
| Itens contratuais | 30 | `contract_items.description` | 30/30 (100%) |
| Itens de licitação Câmara | 21.216 | `tender_items.description` | 21.216/21.216 (100%) |
| Pedidos institucionais | 4.888 | `procurement_requests.object` | 1.971/4.888 (40,3%) |
| Despesas Câmara | 449.374 | `category`, `detail`, `supplier` | categoria 100%; detalhe 38,6%; fornecedor 99,6% |
| Despesas Senado | 35.290 | `category`, `detail`, `supplier` | categoria 99,7%; detalhe 38,1%; fornecedor 100% |
| Vínculos de despesas | 224.865 | `expense_supplier_links` | status `confirmed`; 26.122 fornecedores distintos |

`procurement_processes` não possui linhas normalizadas na cópia atual. Portanto, objeto de licitação deve ser obtido do registro bruto/relacionado quando existir, sem presumir cobertura.

## Força semântica dos campos

| Campo | O que descreve | Força | Risco |
|---|---|---|---|
| `contract.object` | objeto contratado | **forte** | pode agrupar serviços heterogêneos; precisa preservar texto |
| `contract_items.description` | item efetivamente contratado | **forte** | cobertura institucional ainda pequena |
| `tender_items.description` | item licitado | **forte** | descreve intenção/escopo, não necessariamente execução |
| `procurement_requests.object` | demanda interna | útil | pode ser genérico ou anterior ao contrato |
| `expenses.category` | rubrica oficial parlamentar | **forte para o lançamento**, não para identidade completa | não equivale automaticamente à categoria institucional |
| `expenses.detail` | texto do lançamento | útil/forte quando específico | muitos textos administrativos ou repetitivos |
| `supplier`/CNPJ | identidade do favorecido | auxiliar | não descreve o serviço sozinho |
| modalidade, status, número do processo | processo administrativo | ruim para atuação | não dizem o que foi fornecido |
| PCA/ata/aditivo/NE | planejamento, registro ou execução contratual | auxiliar | são contexto; não provam pagamento nem serviço isoladamente |

Valores financeiros devem permanecer separados de temas: contratado, empenhado, liquidado e pago têm semânticas distintas.

## Exploração textual

Foram examinados 191.839 textos combinando objetos de contratos, descrições de itens e detalhes de despesas. Depois de remover termos administrativos genéricos, os sinais mais frequentes foram:

- `veículos automotores`, `companhia aérea`, `combustível`, `passageiros`, `telefonia`, `hospedagem`, `engenharia`, `modernização`, `software`, `backup`, `divulgação`, `locação`;
- clusters institucionais: engenharia/manutenção predial, tecnologia e audiovisual, limpeza/terceirização, equipamentos de saúde, segurança e locação;
- clusters parlamentares: combustíveis, passagens/voos, táxi/estacionamento, manutenção de escritório, telefonia, hospedagem, alimentação, aluguel/locação e divulgação.

Exemplos reais de objetos institucionais: modernização de ar-condicionado; reparo em imóveis funcionais; licenças Adobe; software de backup e armazenamento; outsourcing de impressão; portas e esquadrias; limpeza e conservação; equipamento de imunologia/hormônio; microfones e equipamentos SDI; locação de contêineres.

## Teste determinístico exploratório

Foi aplicado um dicionário versionável de sinais, com exclusões para termos genéricos. Um registro só foi contado como alta confiança quando recebeu um único tema inequívoco; múltiplos sinais ficam como `medium` até revisão.

| Universo | Registros | Com algum tema | Alta confiança (um tema) |
|---|---:|---:|---:|
| Contratos Câmara | 2.181 | 726 (33,3%) | 597 (27,4%) |
| Contratos Senado | 2.626 | 1.135 (43,2%) | 1.102 (42,0%) |
| Itens contratuais | 30 | 4 (13,3%) | 4 (13,3%) |
| Despesas Câmara | 449.374 | 318.436 (70,9%) | 318.436 (70,9%) |
| Despesas Senado | 35.290 | 28.688 (81,3%) | 28.206 (79,9%) |

Os números são cobertura de regra, não precisão humana certificada. O próximo passo de validação deve usar amostras estratificadas de 100 registros por universo e registrar correto/parcial/errado/impossível. Não se deve publicar a regra como fato antes dessa validação.

## Temas propostos a partir dos dados

1. Engenharia, obras e instalações — obras, fachadas, esquadrias, estruturas; não inclui simples manutenção sem obra.
2. Manutenção predial e conservação — limpeza, ar-condicionado, reparos e conservação.
3. Tecnologia, software e dados — software, licenças, backup, armazenamento, digitalização e suporte técnico.
4. Audiovisual e transmissão — microfones, áudio, vídeo, SDI, estúdios e equipamentos de plenário.
5. Telecomunicações e conectividade — telefonia, internet, fibra e conectividade.
6. Publicidade, comunicação e conteúdo — divulgação, assessoria de comunicação e distribuição de conteúdo.
7. Transporte, passagens e logística — passagens, voos, locação/fretamento e logística de deslocamento.
8. Veículos, combustíveis e mobilidade — combustível, lubrificante, veículos e manutenção automotiva.
9. Locação de imóveis e espaços — aluguel de imóveis, salas, contêineres e espaços.
10. Terceirização e apoio operacional — dedicação exclusiva, limpeza operacional e apoio continuado.
11. Segurança — segurança privada, controle e estruturas de ancoragem quando explicitamente associados.
12. Saúde e equipamentos laboratoriais — imunologia, hormônios, urina, reagentes e exames.
13. Alimentação e hospedagem — alimentação, refeições, hospedagem e eventos quando o texto comprovar isso.
14. Material e equipamentos de escritório — consumo, mobiliário, publicações e equipamentos sem sinal de tecnologia especializada.

Um fornecedor pode ter vários temas. A unidade primária recomendada é `relação fornecedor–objeto` (contrato, item ou lançamento), nunca o fornecedor isolado.

## Fornecedor agregado

Para cada fornecedor, calcular separadamente por universo:

- número de relações classificadas;
- número de contratos/itens;
- valor contratado, quando publicado;
- valor efetivamente pago, quando datado;
- número e valor de lançamentos parlamentares.

Não misturar valor institucional contratado com despesa parlamentar. Uma visão agregada pode dizer “atuação observada em Tecnologia e Telecomunicações”, acompanhada de evidência e do denominador utilizado.

## Modelo recomendado

As tabelas sugeridas são:

`suppliers` (identidade), `supplier_theme_taxonomy` (versão, tema, definição), `supplier_theme_rules` (regex, prioridade, exclusões, versão), `supplier_theme_assignments` (supplier_id, source_entity_type/id, theme_id, confidence, method, evidence_text, evidence_field, classified_at, taxonomy_version).

O pipeline deve ser:

`raw → normalização textual → persistência da entidade → classifier determinístico → assignments auditáveis`.

Atualizar contrato, item, licitação, pedido ou despesa deve recalcular somente as relações afetadas. Backfills usam a mesma função e uma nova `taxonomy_version`; versões antigas não são apagadas.

Estados publicados: `high_confidence`, `medium_confidence`, `unclassified`. Textos como “prestação de serviços continuados” sem outra evidência ficam `unclassified`.

## Alternativas de classificação

| Método | Precisão esperada | Custo/latência | Auditoria | Recomendação |
|---|---|---|---|---|
| dicionário + regex + prioridades/exclusões | alta em sinais explícitos | mínimo, determinístico | excelente | padrão do collector |
| modelo supervisionado | depende de rótulos | médio | razoável | só após conjunto rotulado |
| LLM externo | variável | alto e não determinístico | fraca sem revisão | apenas descoberta/revisão |

## Câmara × Senado × parlamentar

Contratos institucionais têm objetos longos e específicos; despesas parlamentares têm cobertura ampla, mas categorias oficiais diferentes entre as Casas. Senado e Câmara não devem compartilhar automaticamente a mesma taxonomia oficial. A classificação Cívica deve manter `official_category` separado de `civica_theme`.

Os vínculos de identidade permitem encontrar fornecedores nos dois mundos, mas a compatibilidade de temas deve ser calculada por evidência, não por nome. Para cada par, classificar futuramente como compatível, complementar ou muito diferente, com amostra auditada.

## Limitações

- Itens institucionais e objetos de pedidos têm cobertura desigual.
- A base atual não contém uma coorte humana rotulada suficiente para afirmar precisão estatística.
- Categoria parlamentar é uma rubrica oficial, não uma descrição completa do fornecedor.
- PCA, ata, aditivo e NE fornecem contexto; não devem ser usados isoladamente para afirmar atuação ou pagamento.

**Não implemente ainda. Este relatório deve ser usado para decidir a taxonomia definitiva.**
