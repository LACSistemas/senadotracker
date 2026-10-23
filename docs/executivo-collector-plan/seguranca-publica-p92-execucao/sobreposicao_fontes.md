# Sobreposição e comparabilidade entre as fontes de Trânsito (P9.2)

Nenhuma soma, razão ou união entre famílias foi calculada ou publicada. Este documento explica por quê e o que é desconhecido.

## O que cada fonte mede

| Fonte | Unidade | Território | Universo | Quem informa |
|---|---|---|---|---|
| SIM (DATASUS) | óbito (declaração de óbito), causa básica CID-10 | município de **residência** *ou* de **ocorrência** | todos os óbitos registrados no país; 2025 preliminar | cartórios, IML, serviços de saúde |
| RENAEST | sinistro (uma linha por `num_acidente`), com vítimas e veículos | município do **sinistro** (código IBGE nativo) | só o que os órgãos participantes reportam; UF e mês variam | órgãos de trânsito/segurança estaduais e municipais |
| PRF datatran | sinistro registrado pela PRF (uma linha por ocorrência) | município por **nome** (+ BR/km, não publicados) | rodovias federais atendidas pela PRF | PRF |
| Senatran frota | veículo **registrado** (Renavam) | município de registro | todo o parque registrado, por mês | Senatran |
| Senatran infrações | notificação de penalidade (NP) por código RENAINF | UF de **jurisdição do veículo** | NPs emitidas no mês | Senatran |

## Relações entre as fontes

| Par | Pode somar? | Pode comparar? | Por quê / o que é desconhecido |
|---|---|---|---|
| SIM × RENAEST | Não | Não como validação | Unidade (óbito × sinistro), local (residência/ocorrência × sinistro), janela de óbito e cobertura diferentes. ES 2023: RENAEST 972 óbitos × SIM 818 (residência, agudo) / 847 (ocorrência). A diferença não se reduz a erro de uma das fontes. |
| SIM residência × SIM ocorrência | Não | Sim, lado a lado | Mesmos óbitos nos 27 arquivos, territórios diferentes: o total nacional é idêntico (conferido por ano). Ocorrência exclui residentes no exterior (arquivo DOEX não preservado). |
| RENAEST × PRF | **Não** | Não | Sem identificador comum. Parte dos sinistros em rodovias federais deve constar nos dois, mas não se sabe quais; a PRF pode ser subconjunto parcial do RENAEST em UFs que reportam e invisível nas que não reportam. Não houve deduplicação por aproximação (data, local, hora). |
| VDE (P9.1) × PRF | Não | Não | O VDE traz mortes no trânsito de rodovias federais (abrangência PRF/PF) e mortes estaduais "exceto homicídio doloso"; ambos podem coincidir com sinistros da PRF/RENAEST. |
| PRF 2007–2015 × PRF 2016+ (total de sinistros) | Não | **Só "com vítimas"** | A partir de 2016 o arquivo traz poucos sinistros sem vítimas (113 mil em 2010 → 34 mil em 2016 → 11 mil em 2019). Fatais + feridas é comparável em toda a série. |
| RENAEST entre UFs | — | Condicional | UFs ausentes (PA quase sempre; AP, MA, RN em 2024), início tardio (SP e SC só passam de 100 mil/ano a partir de 2019), escopo restrito a fatais inferido (RS ≈ 99,7 % com óbito; também AM, MA, AL, SP, MT em meses isolados). Sem ranking nacional de sinistros totais. |
| Frota × população (veículos/1.000 hab.) | — | Condicional | Frota registrada ≠ circulante; sedes de locadoras e frotas empresariais inflam a razão. Sem taxa em 2022 e 2023 (sem população oficial). |
| Frota × sinistros (sinistros por 10 mil veículos) | — | **Não publicado** | O denominador correto de sinistros em rodovias federais ou reportados por UF parcial não é a frota registrada do município. |
| Infrações × qualquer outra | Não | Só entre UFs de jurisdição | A UF é a do veículo; o local da infração não está no arquivo. |
| Atlas/SIM × SIM trânsito | — | — | Não se aplica (Atlas é derivado do SIM, usado só na P9.1). |

## O que não foi feito de propósito

- Nenhum "índice de trânsito seguro" nem ranking que misture famílias.
- Nenhuma taxa de sinistros por habitante ou por veículo.
- Nenhum mapa de sinistros individuais (endereço, CEP, coordenadas e hora do RENAEST e as coordenadas/km da PRF **não** foram persistidos).
- Nenhuma imputação de município para registros sem município; nenhuma inferência de UF para registros da PRF com UF nula.
