# Senado — custos ampliados e gabinete

Verificado em 08/09/2026 no [catálogo administrativo](https://www12.senado.leg.br/dados-abertos/conjuntos?grupo=senadores&portal=Administrativo) e no [Portal da Transparência](https://www25.senado.leg.br/web/transparencia/sen).

| Rubrica | Cobertura | Atribuição | Soma com CEAPS? | Estado |
| --- | --- | --- | --- | --- |
| Subsídio recebido | mensal | senador | sim, em composição parcial | fonte identificada; adaptador pendente |
| Diárias pagas/devolvidas | por viagem | senador | sim, líquido de devoluções | fonte identificada; adaptador pendente |
| Passagens institucionais | viagem/ano | senador quando identificado | sim, se fora da CEAPS | exige reconciliação de sobreposição |
| Auxílio-moradia | fotografia mensal | senador | sim, apenas pagamento | fonte identificada; série histórica limitada |
| Imóvel funcional | ocupação | senador | não | benefício em espécie, sem custo individual publicado |
| Saúde | relatório | senador/ex-senador quando publicado | separado | escopo e privacidade exigem validação |
| Combustível/telegramas | mês/ano | senador quando identificado | somente após deduplicar CEAPS | risco de sobreposição |
| Escritório de apoio | fotografia diária | senador | não | endereço/estrutura, não valor gasto |
| Equipe/folha | pessoa, vínculo e lotação | gabinete quando explícito | sim, como folha do gabinete | fonte de pessoal deve preservar lotação e competência |

O “custo ampliado” é sempre rotulado como composição parcial. Limite, orçamento, apartamento ocupado e quantidade de servidores não são despesas. Valores coletivos sem chave de gabinete permanecem fora da soma individual.

## Coleta material de gabinete

O catálogo de Gestão de Pessoas oferece dois insumos complementares: **Servidores Efetivos e Comissionados**, atualizado diariamente, com nome, unidade, vínculo, admissão, cargo/função e afastamento; e **Remuneração de Servidores**, mensal, com a planilha de pagamentos. O catálogo exibia 08/09/2026 para o cadastro de servidores, mas 30/06/2023 no item de remuneração, embora a página de transparência mantenha acesso mensal mais recente. A implementação deve usar a competência contida no arquivo, não a data textual do catálogo.

O vínculo publicável exige matrícula ou outra chave estável comum aos arquivos e uma unidade de lotação que identifique inequivocamente o gabinete parlamentar. Nome de servidor ou texto aproximado de lotação não basta. Gabinetes compartilhados, unidades administrativas, lideranças e comissões ficam fora da atribuição pessoal até existir uma regra oficial verificável.
