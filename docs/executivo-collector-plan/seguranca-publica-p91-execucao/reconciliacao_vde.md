# Reconciliação Sinesp VDE (P9.1)

Cada arquivo anual foi lido em fluxo, **independentemente** do banco, e seus totais por evento foram comparados com o publicado em `exec_ind_value` (linha da UF) e com a soma de municípios + município ignorado.

- **2015**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2015.xlsx` (SHA-256 `cb085772eaf1c334…`), 820160 linhas, competências 12 publicadas.
- **2016**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2016.xlsx` (SHA-256 `3a4914977c97cbcd…`), 846569 linhas, competências 12 publicadas.
- **2017**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2017.xlsx` (SHA-256 `73ecfa9f3841fc50…`), 764537 linhas, competências 12 publicadas.
- **2018**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2018.xlsx` (SHA-256 `7eeb77b1d270ec80…`), 764187 linhas, competências 12 publicadas.
- **2019**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2019.xlsx` (SHA-256 `9e5071f990a57756…`), 764700 linhas, competências 12 publicadas.
- **2020**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2020.xlsx` (SHA-256 `eb251fbf5cbd4d4d…`), 764700 linhas, competências 12 publicadas.
- **2021**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2021.xlsx` (SHA-256 `69009c47f349c268…`), 764732 linhas, competências 12 publicadas.
- **2022**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2022.xlsx` (SHA-256 `cb65d831a2878a90…`), 764660 linhas, competências 12 publicadas.
- **2023**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2023.xlsx` (SHA-256 `4fcb40f2a02f1ee8…`), 764772 linhas, competências 12 publicadas.
- **2024**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2024.xlsx` (SHA-256 `eb09bf1a5c6be93c…`), 764820 linhas, competências 12 publicadas.
- **2025**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2025.xlsx` (SHA-256 `6b87609815afc534…`), 832302 linhas, competências 12 publicadas.
- **2026**: arquivo `seguranca/sinesp-vde/2026-10-21/bancovde-2026.xlsx` (SHA-256 `dd11c095119416a3…`), 618206 linhas, competências 9 publicadas.

**Resultado:** todos os totais por ano e evento coincidem (arquivo = linha da UF = Σ municípios + município ignorado).

## Total nacional 2025 (Σ das 27 UFs, abrangência Estadual) — eventos com município

| Evento | Total 2025 |
|---|---:|
| Homicídio doloso — Estadual | 31518 |
| Tentativa de homicídio — Estadual | 33881 |
| Lesão corporal seguida de morte — Estadual | 643 |
| Feminicídio — Estadual | 1578 |
| Tentativa de feminicídio — Estadual | 4190 |
| Suicídio — Estadual | 16592 |
| Suicídio de agente do Estado — Estadual | 135 |

Compare: P9 registrou, no arquivo de 2025, homicídio doloso 31.518, feminicídio 1.578 e latrocínio 805 vítimas.
## Comparação com a publicação oficial (Mapa da Segurança Pública 2026, ano 2025)

O Mapa (MJSP) usa o Sinesp com **data de extração 25/02/2026**; o arquivo do VDE lido pelo Cívica é o publicado em 21/10/2026, depois de revisões das UFs. Diferenças pequenas são esperadas e **não foram ajustadas**.

| Indicador (Brasil, 2025) | Mapa 2026 | VDE em 21/10/2026 | Diferença |
|---|---:|---:|---:|
| Homicídio doloso (vítimas) | 31448 | 31518 | +70 (0.22 %) |
| Tentativa de homicídio (vítimas) | 34199 | 33881 | -318 (-0.93 %) |
| Feminicídio (vítimas) | 1548 | 1578 | +30 (1.94 %) |
| Lesão corporal seguida de morte (vítimas) | 644 | 643 | -1 (-0.16 %) |
| Morte por intervenção de agente do Estado (vítimas; Estadual + PF + PRF) | 6583 | 6601 | +18 (0.27 %) |
| Morte no trânsito ou em decorrência dele, exceto homicídio doloso (vítimas) | 25030 | 25074 | +44 (0.18 %) |
| Suicídio de agente do Estado (vítimas; Estadual + PF) | 132 | 138 | +6 (4.55 %) |
| Morte de agente do Estado (vítimas; Estadual + PF) | 187 | 192 | +5 (2.67 %) |


## Zero estrutural e zero ambíguo

- Combinações evento × abrangência sem nenhum valor ≠ 0 em 2015–2026 (zero estrutural, não publicadas): Furto de veículo / PF; Roubo de veículo / PF; Roubo de carga / PF; Roubo a instituição financeira / PF; Morte de agente do Estado / PRF; Suicídio de agente do Estado / PRF.
- Meses de UF × evento com total zero (zero reportado ou ausência de relato; a fonte não distingue): **42290** de 149606 registros de cobertura.
- Apreensão de cocaína e de maconha usam `total_peso`; `total` vem zerado no arquivo (correção à leitura da P9, que classificou o evento como 100 % zero).
- Linhas repetidas na mesma chave somadas: 201686 (DF informa por região administrativa sob o nome BRASÍLIA).
