# P13.5.0 — Roadmap expandido de infraestrutura

## Sequência aprovada

1. **P13.5 — Obras públicas e investimentos:** inventário físico, contratos, execução e entrega, sem confundir fases financeiras.
2. **P13.5.1 — Infraestrutura urbana, habitação e acesso domiciliar:** Censo 2022, Favelas e Comunidades Urbanas, MUNIC/ESTADIC e FJP.
3. **P13.5.2 — Recursos hídricos e barragens:** SNISB, ANM/SIGBM e Atlas Águas, com deduplicação por instalação.
4. **P13.5.3 — Energia expandida e combustíveis:** MMGD, tarifas ANEEL, revendedores e preços ANP.
5. **P13.5.4 — Logística nacional:** instalações portuárias, aeroportos, ferrovias e SNV rodoviário.
6. **P13.5.5 — Integração:** relacionamento empreendimento–contrato–execução–indicador físico.
7. **P13.6:** serving somente após as ondas aprovadas ou bloqueios documentados.

P13.3-R (Anatel) permanece independente e não bloqueia o roadmap. P13.5.1–P13.5.5 não foram iniciadas.

## Decisões de arquitetura

Cada fato recebe entidade física, identificador source-native, geografia, operador, vigência, universo, cobertura e proveniência. Estoque, desempenho e investimento serão camadas distintas. Não haverá score composto nem imputação de inexistência de instalação como desempenho ruim.
