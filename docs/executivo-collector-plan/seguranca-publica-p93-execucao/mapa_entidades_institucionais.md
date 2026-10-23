# Mapa técnico das entidades institucionais (G7) — nada foi criado

A P9.3 **não cria** cadastro de delegacias, batalhões, instalações ou endereços. Este mapa lista o que existe, o que poderá ser integrado e o que falta para cada família. O Cívica **não tem** tabela de órgãos policiais: as corporações aparecem só como atributo (`corporation`) das definições de indicador.

## O que a P9.3 publica (declarações agregadas, sem identidade de unidade)

| Informação | Granularidade | Fonte | Natureza |
|---|---|---|---|
| Município possui delegacia de Polícia Civil (e 9 especializadas, IML, sede de comarca, unidade de bombeiros) | município | MUNIC 2019 e 2023 | existência declarada pela prefeitura; **não é quantidade, endereço, efetivo nem área atendida**; não afirma funcionamento em 2026 |
| Município possui guarda municipal e seu efetivo | município | MUNIC 2019 e 2023 | declaração da prefeitura |
| Delegacias distritais e especializadas da PC; unidades operacionais da PM | UF (total) | ESTADIC 2019 e 2023 | contagem declarada pela UF; não há lista |
| Perícia oficial vinculada à PC | UF | ESTADIC | sim/não |

## Entidades que poderão ser integradas (futuro, fora desta onda)

| Entidade | Esfera | Identidade estável disponível hoje? | Fonte candidata | Pré-requisito para entrar | Onda provável |
|---|---|---|---|---|---|
| Delegacia de Polícia Civil | estadual | **não** (sem código nacional) | cadastros das secretarias estaduais; MUNIC só dá existência | fonte oficial por UF com código/nome estáveis e licença; crosswalk município × unidade | integração por UF (P9.6) |
| CISP do RJ (138 circunscrições) | estadual | sim, na fonte do ISP-RJ (código CISP) | ISP-RJ | modelo de unidade com vigência; vínculo CISP × município/bairro | P9.6 (criminalidade estadual) |
| Batalhões e companhias da PM / CBM | estadual | **não** | PDFs e portais estaduais; ESTADIC só conta unidades | cadastro oficial com identidade estável; proibido derivar de PDF sem código | indefinida |
| Unidades da PRF (delegacias e UOPs) | federal | parcial (referências em ocorrências da PRF, sem cadastro) | PRF | cadastro oficial da PRF; hoje só aparecem como texto em ocorrências | P9.7 ou posterior |
| Unidades prisionais | estadual/federal | sim (SISDEPEN/SENAPPEN, por estabelecimento) | SISDEPEN | P9.4 | **P9.4** |
| Órgãos como entidades (PM-XX, PC-XX, CBM-XX, PF, PRF, DEPEN…) | estadual/federal | por convenção do Cívica (UF + corporação) | os próprios indicadores | decidir se há tabela `exec_orgao`; hoje `corporation` basta | quando houver finanças por órgão (P9.5) |

## Proibido (e não foi feito)

- criar delegacias a partir de notícias; batalhões a partir de nomes em PDF; endereços aproximados de instalações;
- contagem municipal de batalhões; efetivo por delegacia ou por batalhão; lotação inferida de PM ou PC por município;
- usar a presença de delegacia para inferir quantidade de investigadores; usar o local de uma delegacia, posto ou operação como prova de lotação de efetivo federal.

## Regras de integração futura

1. a unidade só entra com **identificador oficial estável**, vigência (`valid_from`/`valid_to`) e fonte/hash no manifesto;
2. a unidade nunca herda efetivo da UF; efetivo por unidade só se a fonte o trouxer;
3. município da unidade resolvido por código IBGE (`exec_entity`), nunca por nome aproximado;
4. a MUNIC continua sendo declaração de existência: ao integrar um cadastro, a divergência entre as duas fontes é preservada, não resolvida.
