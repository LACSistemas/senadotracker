# Validação independente da taxonomia de fornecedores

Data: 24/09/2026  
Seed das amostras: `20260924`  
Status: **NOT_READY**

## Escopo e correção metodológica

O arquivo `taxonomy_samples_20260924.json` continha uma validação circular: o mesmo conjunto de expressões que produziu o tema também produziu a referência. Esta revisão não reutiliza `human_themes` nem o matcher original como verdade.

Foi feita uma segunda leitura semântica contextual, com expressões compostas, precedência e exclusões. Palavras isoladas como “manutenção”, “instalação”, “sistema”, “comunicação”, “suporte”, “infraestrutura”, “segurança” e “produção” não são suficientes.

O resultado completo está em `taxonomy_validation_20260924.json`, com o texto original, previsão antiga, temas esperados na segunda leitura, classificação (`correct`, `partially_correct`, `wrong`, `unclassifiable`) e motivo.

## Dimensões separadas

O texto agora é interpretado em duas dimensões:

**Tema de atuação:** tecnologia, saúde, engenharia, audiovisual, telecomunicações, transporte, veículos, alimentação etc.

**Característica da contratação:** manutenção, locação, aquisição/fornecimento, suporte, instalação e terceirização.

Consequências:

- manutenção de impressora, software ou câmera não vira manutenção predial;
- locação de veículo é mobilidade, com característica `locação`, não o setor “Locação de imóveis”;
- instalação de software não vira engenharia;
- “suporte” só ganha tema quando o objeto do suporte é identificável.

## Regras contextuais adotadas

Sinais fortes incluem `manutenção predial`, `elevador`, `fachada`, `edificação`, `ar-condicionado` predial, `software`, `licença`, `backup`, `microfone`, `SDI`, `telefonia`, `fibra`, `passagem`, `combustível`, `veículo`, `imunologia`, `reagente`, `mobiliário`, `café` e `acervo`.

Exclusões aplicadas:

- `manutenção de software/sistema/impressora/câmera` exclui manutenção predial;
- `locação/fretamento de veículo` exclui locação de imóveis;
- `instalação de software/sistema` exclui engenharia;
- “segurança” sem vigilância, controle de acesso ou objeto físico não recebe automaticamente o tema Segurança.

Evidência específica de item tem precedência sobre objeto genérico do contrato.

## Precisão independente da amostra de 400

Precisão estrita conta apenas `correct`; `partially_correct` é reportado separadamente.

| Universo | High n | Correct | Partial | Wrong | Precision high | Medium n | Correct | Partial | Wrong | Precision medium |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Câmara institucional | 30 | 15 | 5 | 10 | 50,0% | 7 | 0 | 4 | 3 | 0,0% |
| Senado institucional | 38 | 18 | 2 | 18 | 47,4% | 4 | 0 | 0 | 4 | 0,0% |
| Câmara parlamentar | 68 | 64 | 0 | 4 | 94,1% | 2 | 2 | 0 | 0 | 100% |
| Senado parlamentar | 17 | 14 | 2 | 1 | 82,4% | 54 | 50 | 4 | 0 | 92,6% |

Os falsos positivos institucionais vêm principalmente de sinais genéricos em objetos longos: “sistema”, “instalação”, “segurança”, “produção”, “manutenção” e “infraestrutura”. A conclusão anterior de 100% não é válida.

## Matriz de confusão resumida

| Tema previsto | Tema correto mais frequente | Padrão de erro |
|---|---|---|
| Tecnologia | Tecnologia; audiovisual; gestão documental | “sistema” e “produção” sem objeto específico |
| Manutenção predial | Engenharia; manutenção de equipamento; nenhum | “manutenção” isolada |
| Transporte | Transporte + veículos + alimentação | detalhes parlamentares agregam várias rubricas |
| Veículos | Veículos; transporte | locação/fretamento sem distinguir setor |
| Segurança | Engenharia/instalações | “ancoragem” ou “segurança” sem segurança operacional |
| Alimentação/hospedagem | Transporte; alimentação | hospedagem em detalhes de viagem |
| Material de escritório | Tecnologia; material | equipamento sem função identificada |

## Revisão dos 300 não classificados

| Destino após leitura contextual | Quantidade |
|---|---:|
| Classificável com regra simples | 31 |
| Classificável com contexto | 80 |
| Necessita novo tema ou multitema | 9 |
| Realmente não classificável | 180 |

Os 31 casos simples incluem sinais como telefonia, audiovisual, mobiliário, café, medicamentos, reagentes e acervo. Os 80 casos contextuais exigem combinar objeto, item ou categoria. Os 9 casos de novo tema/multitema incluem educação/treinamento, serviços gráficos, eventos e combinações de locação com material. Assim, a cobertura institucional dos contratos inicialmente sem tema poderia subir aproximadamente 120 de 300, ou cerca de 40 pontos percentuais sobre esse subconjunto, sem classificar os 180 casos realmente genéricos.

## Temas adicionais encontrados

A amostra contém evidência para:

- Saúde e serviços médicos;
- Medicamentos e material médico;
- Educação, cursos e treinamento;
- Serviços gráficos e editoração;
- Mobiliário e utilidades;
- Alimentação e bebidas;
- Gestão documental e acervo;
- Seguros;
- Eventos e cerimonial;
- Resíduos e serviços ambientais.

Esses temas devem ser subtemas ou temas próprios somente após validação de volume. “Locação” deve permanecer como característica transversal, não como setor.

## Taxonomia plana versus hierárquica

A estrutura hierárquica é mais adequada:

- Infraestrutura física → obras/engenharia; manutenção predial; instalações;
- Tecnologia e comunicação → software/dados; telecomunicações; audiovisual;
- Operação → transporte; veículos/mobilidade; alimentação/hospedagem;
- Apoio institucional → terceirização; segurança; saúde; educação;
- Conteúdo e relacionamento → publicidade/comunicação; gráficos/editoração; eventos;
- Bens e espaços → mobiliário; materiais; imóveis.

Ela reduz a ambiguidade visual e permite mostrar `Tecnologia > software` sem transformar “locação” ou “manutenção” em setor econômico.

## Categorias oficiais

`official_category` continua separado de `civica_theme`. Categorias agregadas do Senado, como “locomoção, hospedagem, alimentação, combustíveis e lubrificantes”, não devem ser convertidas em um único tema. A decomposição só é permitida quando o detalhe textual fornece evidência. Câmara e Senado mantêm mapeamentos independentes.

## Cobertura estimada após correções

Para contratos institucionais, a cobertura segura atual é aproximadamente 33% na Câmara e 43% no Senado. Regras contextuais podem levar a algo próximo de 45–55% sem reduzir precisão, mas essa faixa é uma estimativa e precisa de revisão cega. Despesas parlamentares têm cobertura lexical maior, porém categorias compostas exigem decomposição e não devem ser tratadas como verdade setorial.

## Decisão

**NOT_READY.** A validação independente encontrou precision high de 50,0% na Câmara institucional e 47,4% no Senado institucional. Os critérios para `READY` não são atendidos. Não há base para publicar as tags sem revisão humana independente e sem um conjunto de testes negativo para palavras genéricas.

Ainda não altere collectors ou schema de produção.
