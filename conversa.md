# Última atualização e status das proposições

Auditoria do status atual e dos eventos de tramitação armazenados na Cívica.

## Como ler

- **Status atual** é uma observação por proposição. Na Câmara, vem principalmente de `payload.status`; no Senado, de `matter_detail.status`, com fallback para a situação mais recente datada.
- **Data da última atualização** é distinta da data de apresentação. No Senado, corresponde a `lastUpdated` do processo. Na Câmara, só está preservada nos detalhes individuais já enriquecidos; o catálogo anual armazenou a descrição do último status, mas não sua data.
- **Evento histórico** é cada movimento, situação, item de pauta, efeito de votação, votação em comissão ou norma resultante ligado à proposição. Uma proposição pode possuir muitos eventos.
- Contagens de eventos medem a profundidade documental disponível, não produtividade, importância ou eficiência.

## Conhecimento geral do acervo ativo

### Cobertura por Casa

| Categoria | Proposições | Com status atual | Cobertura | Com data da última atualização | Eventos no histórico | Status distintos |
|---|---:|---:|---:|---:|---:|---:|
| Senado Federal | 40.267 | 2.586 | 6,4% | 2.574 | 26.048 | 54 |
| Câmara dos Deputados | 44.356 | 20.390 | 46,0% | 36 | 21.286 | 43 |

### Cobertura e eventos por `grupo_atribuido`

| Categoria | Proposições | Com status atual | Cobertura | Com data da última atualização | Eventos no histórico | Status distintos |
|---|---:|---:|---:|---:|---:|---:|
| Requerimentos | 30.027 | 10.681 | 35,6% | 1.586 | 25.827 | 58 |
| Proposições legislativas principais | 22.064 | 5.522 | 25,0% | 894 | 14.154 | 51 |
| Pareceres e relatórios | 10.758 | 377 | 3,5% | 0 | 4.632 | 5 |
| Instrumentos de votação/tramitação | 6.821 | 1.751 | 25,7% | 0 | 0 | 4 |
| Emendas e substitutivos | 5.169 | 432 | 8,4% | 0 | 0 | 4 |
| Atos/documentos especiais | 4.050 | 1.367 | 33,8% | 40 | 720 | 25 |
| Ofícios e documentos | 2.719 | 1.166 | 42,9% | 9 | 302 | 6 |
| Indicações e sugestões | 1.910 | 1.561 | 81,7% | 28 | 286 | 16 |
| Mensagens e comunicações institucionais | 1.058 | 89 | 8,4% | 51 | 1.383 | 15 |
| Recursos, representações e petições | 47 | 30 | 63,8% | 2 | 30 | 11 |

### Cobertura e eventos por sigla

| Categoria | Proposições | Com status atual | Cobertura | Com data da última atualização | Eventos no histórico | Status distintos |
|---|---:|---:|---:|---:|---:|---:|
| REQ | 15.638 | 7.468 | 47,8% | 922 | 21.384 | 47 |
| RQS | 11.502 | 664 | 5,8% | 664 | 4.443 | 21 |
| PL | 11.370 | 3.879 | 34,1% | 462 | 5.930 | 38 |
| PRL | 6.872 | 8 | 0,1% | 0 | 4.126 | 2 |
| RPD | 6.520 | 1.501 | 23,0% | 0 | 0 | 3 |
| PDL | 3.504 | 1.237 | 35,3% | 311 | 5.122 | 26 |
| PLS | 3.115 | 0 | 0,0% | 0 | 10 | 0 |
| PAR | 2.968 | 1 | 0,0% | 0 | 496 | 1 |
| RIC | 2.568 | 2.549 | 99,3% | 0 | 0 | 6 |
| DOC | 2.451 | 1.133 | 46,2% | 0 | 0 | 4 |
| INC | 1.575 | 1.513 | 96,1% | 0 | 0 | 9 |
| SBT | 1.543 | 1 | 0,1% | 0 | 0 | 1 |
| EMC | 1.340 | 1 | 0,1% | 0 | 0 | 1 |
| PDS | 1.043 | 0 | 0,0% | 0 | 5 | 0 |
| PEC | 995 | 19 | 1,9% | 14 | 278 | 13 |
| RDH | 800 | 0 | 0,0% | 0 | 0 | 0 |
| RDF | 715 | 715 | 100,0% | 0 | 0 | 1 |
| MSF | 664 | 51 | 7,7% | 51 | 1.383 | 5 |
| SBT-A | 636 | 0 | 0,0% | 0 | 0 | 0 |
| PLC | 597 | 0 | 0,0% | 0 | 2 | 0 |
| PLP | 583 | 241 | 41,3% | 48 | 1.107 | 19 |
| PARF | 542 | 0 | 0,0% | 0 | 0 | 0 |
| PRS | 481 | 24 | 5,0% | 24 | 289 | 3 |
| EMR | 454 | 1 | 0,2% | 0 | 0 | 1 |
| INS | 441 | 25 | 5,7% | 25 | 226 | 3 |
| EMP | 423 | 423 | 100,0% | 0 | 0 | 1 |
| MSC | 368 | 37 | 10,1% | 0 | 0 | 10 |
| SUG | 335 | 48 | 14,3% | 28 | 286 | 8 |
| EMC-A | 313 | 0 | 0,0% | 0 | 0 | 0 |
| ATA | 310 | 310 | 100,0% | 0 | 0 | 2 |
| PRLP | 283 | 276 | 97,5% | 0 | 0 | 1 |
| DTQ | 245 | 230 | 93,9% | 0 | 0 | 1 |
| TVR | 218 | 173 | 79,4% | 0 | 0 | 7 |
| OFS | 208 | 8 | 3,8% | 8 | 285 | 1 |
| MPV | 206 | 48 | 23,3% | 24 | 1.271 | 11 |
| SBR | 204 | 0 | 0,0% | 0 | 0 | 0 |
| RAS | 158 | 0 | 0,0% | 0 | 0 | 0 |
| RQN | 157 | 0 | 0,0% | 0 | 0 | 0 |
| R.S | 154 | 6 | 3,9% | 6 | 7 | 2 |
| RCE | 138 | 0 | 0,0% | 0 | 0 | 0 |
| PPP | 136 | 0 | 0,0% | 0 | 214 | 0 |
| SBE-A | 130 | 0 | 0,0% | 0 | 0 | 0 |
| ESB | 119 | 0 | 0,0% | 0 | 0 | 0 |
| PLN | 112 | 25 | 22,3% | 1 | 23 | 3 |
| RMA | 100 | 0 | 0,0% | 0 | 0 | 0 |
| RQJ | 96 | 0 | 0,0% | 0 | 0 | 0 |
| RCT | 86 | 0 | 0,0% | 0 | 0 | 0 |
| RQI | 82 | 0 | 0,0% | 0 | 0 | 0 |
| RQE | 80 | 0 | 0,0% | 0 | 0 | 0 |
| PRLE | 71 | 71 | 100,0% | 0 | 0 | 1 |
| RDR | 60 | 0 | 0,0% | 0 | 0 | 0 |
| PEP | 54 | 2 | 3,7% | 2 | 164 | 1 |
| SIT | 51 | 50 | 98,0% | 0 | 0 | 4 |
| AVN | 49 | 0 | 0,0% | 0 | 0 | 0 |
| RRA | 49 | 0 | 0,0% | 0 | 0 | 0 |
| PRC | 43 | 41 | 95,3% | 3 | 109 | 8 |
| AVS | 37 | 0 | 0,0% | 0 | 0 | 0 |
| RRE | 37 | 0 | 0,0% | 0 | 0 | 0 |
| PFS | 36 | 2 | 5,6% | 2 | 14 | 1 |
| VTS | 36 | 1 | 2,8% | 0 | 0 | 1 |
| OFN | 33 | 1 | 3,0% | 1 | 17 | 1 |
| OF | 26 | 24 | 92,3% | 0 | 0 | 2 |
| PFC | 26 | 23 | 88,5% | 0 | 0 | 2 |
| SCD | 26 | 0 | 0,0% | 0 | 0 | 0 |
| MCN | 24 | 1 | 4,2% | 0 | 0 | 1 |
| ERD | 23 | 17 | 73,9% | 0 | 0 | 1 |
| CAC | 21 | 16 | 76,2% | 0 | 13 | 4 |
| PES | 20 | 0 | 0,0% | 0 | 9 | 0 |
| RPDR | 20 | 19 | 95,0% | 0 | 0 | 3 |
| CVO | 19 | 0 | 0,0% | 0 | 0 | 0 |
| SSP | 19 | 0 | 0,0% | 0 | 0 | 0 |
| REC | 18 | 18 | 100,0% | 0 | 4 | 6 |
| REL | 18 | 18 | 100,0% | 0 | 9 | 4 |
| PRN | 17 | 0 | 0,0% | 0 | 0 | 0 |
| RFF | 17 | 0 | 0,0% | 0 | 0 | 0 |
| PET | 16 | 2 | 12,5% | 2 | 2 | 1 |
| PLV | 15 | 8 | 53,3% | 7 | 8 | 2 |
| REP | 13 | 10 | 76,9% | 0 | 24 | 4 |
| PSS | 12 | 0 | 0,0% | 0 | 26 | 0 |
| RRL | 12 | 0 | 0,0% | 0 | 4 | 0 |
| PCE | 11 | 2 | 18,2% | 2 | 6 | 1 |
| DEN | 10 | 0 | 0,0% | 0 | 0 | 0 |
| ECD | 9 | 0 | 0,0% | 0 | 0 | 0 |
| PPR | 9 | 0 | 0,0% | 0 | 15 | 0 |
| RTG | 9 | 0 | 0,0% | 0 | 0 | 0 |
| ATS | 8 | 0 | 0,0% | 0 | 0 | 0 |
| INA | 8 | 8 | 100,0% | 0 | 0 | 2 |
| PROC | 8 | 7 | 87,5% | 0 | 0 | 3 |
| PRV | 6 | 0 | 0,0% | 0 | 3 | 0 |
| EMA | 5 | 5 | 100,0% | 0 | 0 | 1 |
| R.C | 5 | 3 | 60,0% | 3 | 18 | 1 |
| AMA | 4 | 0 | 0,0% | 0 | 0 | 0 |
| PDH | 4 | 0 | 0,0% | 0 | 0 | 0 |
| CON | 3 | 0 | 0,0% | 0 | 0 | 0 |
| DIV | 3 | 0 | 0,0% | 0 | 0 | 0 |
| PRO | 3 | 3 | 100,0% | 0 | 0 | 3 |
| REL-A | 3 | 3 | 100,0% | 0 | 0 | 2 |
| DAS | 2 | 0 | 0,0% | 0 | 0 | 0 |
| EMS | 2 | 1 | 50,0% | 0 | 0 | 1 |
| MSG | 2 | 0 | 0,0% | 0 | 0 | 0 |
| RCP | 2 | 2 | 100,0% | 0 | 0 | 1 |
| SIN | 2 | 0 | 0,0% | 0 | 0 | 0 |
| SOR | 2 | 2 | 100,0% | 0 | 0 | 1 |
| ADF | 1 | 0 | 0,0% | 0 | 0 | 0 |
| OBJ | 1 | 1 | 100,0% | 0 | 1 | 1 |
| OFTFC | 1 | 0 | 0,0% | 0 | 0 | 0 |
| PRM | 1 | 0 | 0,0% | 0 | 0 | 0 |
| RLP | 1 | 0 | 0,0% | 0 | 1 | 0 |
| RQR | 1 | 0 | 0,0% | 0 | 0 | 0 |
| RVM | 1 | 0 | 0,0% | 0 | 0 | 0 |

### Breakdown dos eventos por grupo

| Categoria | Total de eventos | Movimentos | Situações | Pautas | Efeitos de votação | Votos em comissão | Normas resultantes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Requerimentos | 25.827 | 17.023 | 5.365 | 3.439 | 0 | 0 | 0 |
| Proposições legislativas principais | 14.154 | 7.768 | 3.462 | 1.665 | 1.195 | 0 | 64 |
| Pareceres e relatórios | 4.632 | 0 | 0 | 4.632 | 0 | 0 | 0 |
| Instrumentos de votação/tramitação | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Emendas e substitutivos | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Atos/documentos especiais | 720 | 173 | 96 | 451 | 0 | 0 | 0 |
| Ofícios e documentos | 302 | 194 | 80 | 28 | 0 | 0 | 0 |
| Indicações e sugestões | 286 | 119 | 127 | 40 | 0 | 0 | 0 |
| Mensagens e comunicações institucionais | 1.383 | 903 | 420 | 60 | 0 | 0 | 0 |
| Recursos, representações e petições | 30 | 0 | 2 | 28 | 0 | 0 | 0 |

### Breakdown dos eventos por sigla

| Categoria | Total de eventos | Movimentos | Situações | Pautas | Efeitos de votação | Votos em comissão | Normas resultantes |
|---|---:|---:|---:|---:|---:|---:|---:|
| REQ | 21.384 | 14.366 | 3.579 | 3.439 | 0 | 0 | 0 |
| RQS | 4.443 | 2.657 | 1.786 | 0 | 0 | 0 | 0 |
| PL | 5.930 | 3.010 | 1.497 | 981 | 433 | 0 | 9 |
| PRL | 4.126 | 0 | 0 | 4.126 | 0 | 0 | 0 |
| RPD | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PDL | 5.122 | 3.047 | 1.503 | 505 | 42 | 0 | 25 |
| PLS | 10 | 0 | 0 | 10 | 0 | 0 | 0 |
| PAR | 496 | 0 | 0 | 496 | 0 | 0 | 0 |
| RIC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DOC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| INC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SBT | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| EMC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PDS | 5 | 0 | 0 | 5 | 0 | 0 | 0 |
| PEC | 278 | 196 | 71 | 11 | 0 | 0 | 0 |
| RDH | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RDF | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MSF | 1.383 | 903 | 420 | 60 | 0 | 0 | 0 |
| SBT-A | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PLC | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| PLP | 1.107 | 455 | 136 | 68 | 445 | 0 | 3 |
| PARF | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PRS | 289 | 193 | 66 | 12 | 0 | 0 | 18 |
| EMR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| INS | 226 | 148 | 78 | 0 | 0 | 0 | 0 |
| EMP | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MSC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SUG | 286 | 119 | 127 | 40 | 0 | 0 | 0 |
| EMC-A | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ATA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PRLP | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DTQ | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| TVR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| OFS | 285 | 184 | 74 | 27 | 0 | 0 | 0 |
| MPV | 1.271 | 781 | 182 | 62 | 237 | 0 | 9 |
| SBR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RAS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RQN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| R.S | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| RCE | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PPP | 214 | 0 | 0 | 214 | 0 | 0 | 0 |
| SBE-A | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ESB | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PLN | 23 | 16 | 7 | 0 | 0 | 0 | 0 |
| RMA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RQJ | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RCT | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RQI | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RQE | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PRLE | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RDR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PEP | 164 | 2 | 0 | 162 | 0 | 0 | 0 |
| SIT | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| AVN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RRA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PRC | 109 | 62 | 0 | 9 | 38 | 0 | 0 |
| AVS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RRE | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PFS | 14 | 6 | 4 | 4 | 0 | 0 | 0 |
| VTS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| OFN | 17 | 10 | 6 | 1 | 0 | 0 | 0 |
| OF | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PFC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SCD | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MCN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ERD | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| CAC | 13 | 0 | 0 | 13 | 0 | 0 | 0 |
| PES | 9 | 0 | 0 | 9 | 0 | 0 | 0 |
| RPDR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| CVO | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SSP | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| REC | 4 | 0 | 0 | 4 | 0 | 0 | 0 |
| REL | 9 | 0 | 0 | 9 | 0 | 0 | 0 |
| PRN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RFF | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PET | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| PLV | 8 | 8 | 0 | 0 | 0 | 0 | 0 |
| REP | 24 | 0 | 0 | 24 | 0 | 0 | 0 |
| PSS | 26 | 0 | 0 | 26 | 0 | 0 | 0 |
| RRL | 4 | 0 | 0 | 4 | 0 | 0 | 0 |
| PCE | 6 | 2 | 4 | 0 | 0 | 0 | 0 |
| DEN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ECD | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PPR | 15 | 0 | 0 | 15 | 0 | 0 | 0 |
| RTG | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ATS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| INA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PROC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PRV | 3 | 0 | 0 | 3 | 0 | 0 | 0 |
| EMA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| R.C | 18 | 15 | 3 | 0 | 0 | 0 | 0 |
| AMA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PDH | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| CON | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DIV | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PRO | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| REL-A | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DAS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| EMS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MSG | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RCP | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SIN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ADF | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| OBJ | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| OFTFC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PRM | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RLP | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| RQR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| RVM | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Recorte de proposições de 2026

### Cobertura por Casa

| Categoria | Proposições | Com status atual | Cobertura | Com data da última atualização | Eventos no histórico | Status distintos |
|---|---:|---:|---:|---:|---:|---:|
| Senado Federal | 2.238 | 2.236 | 99,9% | 2.224 | 17.948 | 51 |
| Câmara dos Deputados | 22.102 | 17.139 | 77,5% | 34 | 16.299 | 41 |

### Cobertura e eventos por `grupo_atribuido`

| Categoria | Proposições | Com status atual | Cobertura | Com data da última atualização | Eventos no histórico | Status distintos |
|---|---:|---:|---:|---:|---:|---:|
| Requerimentos | 10.886 | 10.681 | 98,1% | 1.586 | 25.821 | 58 |
| Proposições legislativas principais | 6.709 | 5.193 | 77,4% | 565 | 6.748 | 46 |
| Ofícios e documentos | 2.482 | 1.162 | 46,8% | 5 | 154 | 6 |
| Indicações e sugestões | 1.623 | 1.561 | 96,2% | 28 | 254 | 16 |
| Emendas e substitutivos | 1.458 | 2 | 0,1% | 0 | 0 | 2 |
| Atos/documentos especiais | 688 | 633 | 92,0% | 38 | 281 | 24 |
| Mensagens e comunicações institucionais | 403 | 72 | 17,9% | 34 | 879 | 15 |
| Pareceres e relatórios | 40 | 21 | 52,5% | 0 | 80 | 4 |
| Recursos, representações e petições | 30 | 30 | 100,0% | 2 | 30 | 11 |
| Instrumentos de votação/tramitação | 21 | 20 | 95,2% | 0 | 0 | 4 |

### Cobertura e eventos por sigla

| Categoria | Proposições | Com status atual | Cobertura | Com data da última atualização | Eventos no histórico | Status distintos |
|---|---:|---:|---:|---:|---:|---:|
| REQ | 7.654 | 7.468 | 97,6% | 922 | 21.378 | 47 |
| PL | 5.263 | 3.820 | 72,6% | 403 | 3.657 | 34 |
| RIC | 2.568 | 2.549 | 99,3% | 0 | 0 | 6 |
| DOC | 2.451 | 1.133 | 46,2% | 0 | 0 | 4 |
| INC | 1.575 | 1.513 | 96,1% | 0 | 0 | 9 |
| EMC | 1.338 | 1 | 0,1% | 0 | 0 | 1 |
| PDL | 1.005 | 975 | 97,0% | 49 | 471 | 24 |
| RQS | 664 | 664 | 100,0% | 664 | 4.443 | 21 |
| MSC | 368 | 37 | 10,1% | 0 | 0 | 10 |
| ATA | 310 | 310 | 100,0% | 0 | 0 | 2 |
| PLP | 247 | 237 | 96,0% | 44 | 871 | 18 |
| TVR | 218 | 173 | 79,4% | 0 | 0 | 7 |
| ESB | 118 | 0 | 0,0% | 0 | 0 | 0 |
| MPV | 75 | 48 | 64,0% | 24 | 1.265 | 11 |
| SIT | 51 | 50 | 98,0% | 0 | 0 | 4 |
| SUG | 48 | 48 | 100,0% | 28 | 254 | 8 |
| PRC | 43 | 41 | 95,3% | 3 | 109 | 8 |
| MSF | 34 | 34 | 100,0% | 34 | 879 | 5 |
| OF | 26 | 24 | 92,3% | 0 | 0 | 2 |
| PFC | 26 | 23 | 88,5% | 0 | 0 | 2 |
| INS | 25 | 25 | 100,0% | 25 | 226 | 3 |
| PLN | 25 | 25 | 100,0% | 1 | 23 | 3 |
| PRS | 24 | 24 | 100,0% | 24 | 277 | 3 |
| CAC | 21 | 16 | 76,2% | 0 | 13 | 4 |
| RPDR | 20 | 19 | 95,0% | 0 | 0 | 3 |
| PAR | 19 | 0 | 0,0% | 0 | 71 | 0 |
| REC | 18 | 18 | 100,0% | 0 | 4 | 6 |
| REL | 18 | 18 | 100,0% | 0 | 9 | 4 |
| PEC | 16 | 15 | 93,8% | 10 | 67 | 9 |
| PLV | 11 | 8 | 72,7% | 7 | 8 | 2 |
| REP | 10 | 10 | 100,0% | 0 | 24 | 4 |
| INA | 8 | 8 | 100,0% | 0 | 0 | 2 |
| PROC | 8 | 7 | 87,5% | 0 | 0 | 3 |
| R.S | 6 | 6 | 100,0% | 6 | 7 | 2 |
| OFS | 4 | 4 | 100,0% | 4 | 137 | 1 |
| PRO | 3 | 3 | 100,0% | 0 | 0 | 3 |
| R.C | 3 | 3 | 100,0% | 3 | 18 | 1 |
| REL-A | 3 | 3 | 100,0% | 0 | 0 | 2 |
| EMS | 2 | 1 | 50,0% | 0 | 0 | 1 |
| PCE | 2 | 2 | 100,0% | 2 | 6 | 1 |
| PET | 2 | 2 | 100,0% | 2 | 2 | 1 |
| PFS | 2 | 2 | 100,0% | 2 | 10 | 1 |
| RCP | 2 | 2 | 100,0% | 0 | 0 | 1 |
| SOR | 2 | 2 | 100,0% | 0 | 0 | 1 |
| MCN | 1 | 1 | 100,0% | 0 | 0 | 1 |
| OBJ | 1 | 1 | 100,0% | 0 | 1 | 1 |
| OFN | 1 | 1 | 100,0% | 1 | 17 | 1 |
| RPD | 1 | 1 | 100,0% | 0 | 0 | 1 |

### Breakdown dos eventos por grupo

| Categoria | Total de eventos | Movimentos | Situações | Pautas | Efeitos de votação | Votos em comissão | Normas resultantes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Requerimentos | 25.821 | 17.023 | 5.365 | 3.433 | 0 | 0 | 0 |
| Proposições legislativas principais | 6.748 | 3.810 | 1.490 | 219 | 1.195 | 0 | 34 |
| Ofícios e documentos | 154 | 102 | 43 | 9 | 0 | 0 | 0 |
| Indicações e sugestões | 254 | 119 | 127 | 8 | 0 | 0 | 0 |
| Emendas e substitutivos | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Atos/documentos especiais | 281 | 171 | 96 | 14 | 0 | 0 | 0 |
| Mensagens e comunicações institucionais | 879 | 545 | 277 | 57 | 0 | 0 | 0 |
| Pareceres e relatórios | 80 | 0 | 0 | 80 | 0 | 0 | 0 |
| Recursos, representações e petições | 30 | 0 | 2 | 28 | 0 | 0 | 0 |
| Instrumentos de votação/tramitação | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Breakdown dos eventos por sigla

| Categoria | Total de eventos | Movimentos | Situações | Pautas | Efeitos de votação | Votos em comissão | Normas resultantes |
|---|---:|---:|---:|---:|---:|---:|---:|
| REQ | 21.378 | 14.366 | 3.579 | 3.433 | 0 | 0 | 0 |
| PL | 3.657 | 2.082 | 1.038 | 101 | 433 | 0 | 3 |
| RIC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| DOC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| INC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| EMC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PDL | 471 | 312 | 100 | 14 | 42 | 0 | 3 |
| RQS | 4.443 | 2.657 | 1.786 | 0 | 0 | 0 | 0 |
| MSC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ATA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PLP | 871 | 315 | 71 | 39 | 445 | 0 | 1 |
| TVR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ESB | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MPV | 1.265 | 781 | 182 | 56 | 237 | 0 | 9 |
| SIT | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SUG | 254 | 119 | 127 | 8 | 0 | 0 | 0 |
| PRC | 109 | 62 | 0 | 9 | 38 | 0 | 0 |
| MSF | 879 | 545 | 277 | 57 | 0 | 0 | 0 |
| OF | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PFC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| INS | 226 | 148 | 78 | 0 | 0 | 0 | 0 |
| PLN | 23 | 16 | 7 | 0 | 0 | 0 | 0 |
| PRS | 277 | 193 | 66 | 0 | 0 | 0 | 18 |
| CAC | 13 | 0 | 0 | 13 | 0 | 0 | 0 |
| RPDR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PAR | 71 | 0 | 0 | 71 | 0 | 0 | 0 |
| REC | 4 | 0 | 0 | 4 | 0 | 0 | 0 |
| REL | 9 | 0 | 0 | 9 | 0 | 0 | 0 |
| PEC | 67 | 41 | 26 | 0 | 0 | 0 | 0 |
| PLV | 8 | 8 | 0 | 0 | 0 | 0 | 0 |
| REP | 24 | 0 | 0 | 24 | 0 | 0 | 0 |
| INA | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PROC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| R.S | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| OFS | 137 | 92 | 37 | 8 | 0 | 0 | 0 |
| PRO | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| R.C | 18 | 15 | 3 | 0 | 0 | 0 | 0 |
| REL-A | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| EMS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| PCE | 6 | 2 | 4 | 0 | 0 | 0 | 0 |
| PET | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| PFS | 10 | 6 | 4 | 0 | 0 | 0 | 0 |
| RCP | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MCN | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| OBJ | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| OFN | 17 | 10 | 6 | 1 | 0 | 0 | 0 |
| RPD | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Cinco últimos status mais frequentes por grupo — acervo ativo

Cada lista usa o status atual efetivo de uma proposição, sem somar estados antigos do histórico.

### Requerimentos

Cobertura: 10.681 de 30.027 proposições (35,6%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Tramitação Finalizada | 2.446 | 22,9% |
| 2 | Aguardando Remessa ao Arquivo | 1.762 | 16,5% |
| 3 | Aguardando Providências Internas | 1.359 | 12,7% |
| 4 | Aguardando Despacho do Presidente da Câmara dos Deputados | 1.196 | 11,2% |
| 5 | Arquivada | 783 | 7,3% |

### Proposições legislativas principais

Cobertura: 5.522 de 22.064 proposições (25,0%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Designação de Relator(a) | 1.255 | 22,7% |
| 2 | Aguardando Parecer | 1.124 | 20,4% |
| 3 | Tramitando em Conjunto | 677 | 12,3% |
| 4 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 633 | 11,5% |
| 5 | AGUARDANDO DESPACHO | 336 | 6,1% |

### Pareceres e relatórios

Cobertura: 377 de 10.758 proposições (3,5%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Providências Internas | 360 | 95,5% |
| 2 | Pronta para Pauta | 9 | 2,4% |
| 3 | Aguardando Análise de Parecer | 6 | 1,6% |
| 4 | Aguardando Deliberação | 1 | 0,3% |
| 5 | Arquivada | 1 | 0,3% |

### Instrumentos de votação/tramitação

Cobertura: 1.751 de 6.821 proposições (25,7%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Providências Internas | 1.739 | 99,3% |
| 2 | Arquivada | 9 | 0,5% |
| 3 | Aguardando Despacho do Presidente da Câmara dos Deputados | 2 | 0,1% |
| 4 | Pronta para Pauta | 1 | 0,1% |

### Emendas e substitutivos

Cobertura: 432 de 5.169 proposições (8,4%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Providências Internas | 429 | 99,3% |
| 2 | Aguardando Encaminhamento | 1 | 0,2% |
| 3 | Aguardando Recurso | 1 | 0,2% |
| 4 | Arquivada | 1 | 0,2% |

### Atos/documentos especiais

Cobertura: 1.367 de 4.050 proposições (33,8%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Pronta para Pauta | 719 | 52,6% |
| 2 | Aguardando Despacho do Presidente da Câmara dos Deputados | 188 | 13,8% |
| 3 | Aguardando Providências Internas | 176 | 12,9% |
| 4 | Aguardando Designação de Relator(a) | 94 | 6,9% |
| 5 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 50 | 3,7% |

### Ofícios e documentos

Cobertura: 1.166 de 2.719 proposições (42,9%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Arquivada | 1.001 | 85,8% |
| 2 | Aguardando Encaminhamento | 107 | 9,2% |
| 3 | Aguardando Despacho do Presidente da Câmara dos Deputados | 30 | 2,6% |
| 4 | Aguardando Providências Internas | 19 | 1,6% |
| 5 | APROVADA | 8 | 0,7% |

### Indicações e sugestões

Cobertura: 1.561 de 1.910 proposições (81,7%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Resposta | 1.291 | 82,7% |
| 2 | Aguardando Remessa ao Arquivo | 151 | 9,7% |
| 3 | Aguardando Chancela e Publicação do Despacho | 32 | 2,0% |
| 4 | MATÉRIA COM A RELATORIA | 20 | 1,3% |
| 5 | Aguardando Designação de Relator(a) | 19 | 1,2% |

### Mensagens e comunicações institucionais

Cobertura: 89 de 1.058 proposições (8,4%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | APROVADA | 29 | 32,6% |
| 2 | TRANSFORMADA EM PROJETO DE RESOLUÇÃO DO SENADO | 18 | 20,2% |
| 3 | Aguardando Designação de Relator(a) | 9 | 10,1% |
| 4 | Arquivada | 8 | 9,0% |
| 5 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 7 | 7,9% |

### Recursos, representações e petições

Cobertura: 30 de 47 proposições (63,8%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Despacho do Presidente da Câmara dos Deputados | 7 | 23,3% |
| 2 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 5 | 16,7% |
| 3 | Pronta para Pauta | 5 | 16,7% |
| 4 | Aguardando Deliberação | 3 | 10,0% |
| 5 | Aguardando Despacho do Presidente da Câmara dos Deputados (Análise) | 2 | 6,7% |

## Cinco últimos status mais frequentes por grupo — proposições de 2026

Cada lista usa o status atual efetivo de uma proposiçõo, sem somar estados antigos do histórico.

### Requerimentos

Cobertura: 10.681 de 10.886 proposições (98,1%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Tramitação Finalizada | 2.446 | 22,9% |
| 2 | Aguardando Remessa ao Arquivo | 1.762 | 16,5% |
| 3 | Aguardando Providências Internas | 1.359 | 12,7% |
| 4 | Aguardando Despacho do Presidente da Câmara dos Deputados | 1.196 | 11,2% |
| 5 | Arquivada | 783 | 7,3% |

### Proposições legislativas principais

Cobertura: 5.193 de 6.709 proposições (77,4%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Designação de Relator(a) | 1.255 | 24,2% |
| 2 | Aguardando Parecer | 1.124 | 21,6% |
| 3 | Tramitando em Conjunto | 677 | 13,0% |
| 4 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 633 | 12,2% |
| 5 | AGUARDANDO DESPACHO | 336 | 6,5% |

### Ofícios e documentos

Cobertura: 1.162 de 2.482 proposições (46,8%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Arquivada | 1.001 | 86,1% |
| 2 | Aguardando Encaminhamento | 107 | 9,2% |
| 3 | Aguardando Despacho do Presidente da Câmara dos Deputados | 30 | 2,6% |
| 4 | Aguardando Providências Internas | 19 | 1,6% |
| 5 | APROVADA | 4 | 0,3% |

### Indicações e sugestões

Cobertura: 1.561 de 1.623 proposições (96,2%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Resposta | 1.291 | 82,7% |
| 2 | Aguardando Remessa ao Arquivo | 151 | 9,7% |
| 3 | Aguardando Chancela e Publicação do Despacho | 32 | 2,0% |
| 4 | MATÉRIA COM A RELATORIA | 20 | 1,3% |
| 5 | Aguardando Designação de Relator(a) | 19 | 1,2% |

### Emendas e substitutivos

Cobertura: 2 de 1.458 proposições (0,1%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Encaminhamento | 1 | 50,0% |
| 2 | Arquivada | 1 | 50,0% |

### Atos/documentos especiais

Cobertura: 633 de 688 proposições (92,0%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Despacho do Presidente da Câmara dos Deputados | 188 | 29,7% |
| 2 | Aguardando Providências Internas | 159 | 25,1% |
| 3 | Aguardando Designação de Relator(a) | 94 | 14,8% |
| 4 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 50 | 7,9% |
| 5 | Aguardando Parecer | 47 | 7,4% |

### Mensagens e comunicações institucionais

Cobertura: 72 de 403 proposições (17,9%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | TRANSFORMADA EM PROJETO DE RESOLUÇÃO DO SENADO | 18 | 25,0% |
| 2 | APROVADA | 12 | 16,7% |
| 3 | Aguardando Designação de Relator(a) | 9 | 12,5% |
| 4 | Arquivada | 8 | 11,1% |
| 5 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 7 | 9,7% |

### Pareceres e relatórios

Cobertura: 21 de 40 proposições (52,5%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Providências Internas | 13 | 61,9% |
| 2 | Pronta para Pauta | 6 | 28,6% |
| 3 | Aguardando Deliberação | 1 | 4,8% |
| 4 | Arquivada | 1 | 4,8% |

### Recursos, representações e petições

Cobertura: 30 de 30 proposições (100,0%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Despacho do Presidente da Câmara dos Deputados | 7 | 23,3% |
| 2 | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 5 | 16,7% |
| 3 | Pronta para Pauta | 5 | 16,7% |
| 4 | Aguardando Deliberação | 3 | 10,0% |
| 5 | Aguardando Despacho do Presidente da Câmara dos Deputados (Análise) | 2 | 6,7% |

### Instrumentos de votação/tramitação

Cobertura: 20 de 21 proposições (95,2%).

| Posição | Último status | Proposições | % entre status conhecidos do grupo |
|---:|---|---:|---:|
| 1 | Aguardando Providências Internas | 10 | 50,0% |
| 2 | Arquivada | 7 | 35,0% |
| 3 | Aguardando Despacho do Presidente da Câmara dos Deputados | 2 | 10,0% |
| 4 | Pronta para Pauta | 1 | 5,0% |

## Distribuição geral dos status atuais

| Casa | Último status | Proposições |
|---|---|---:|
| Senado Federal | AGUARDANDO DESPACHO | 527 |
| Senado Federal | MATÉRIA COM A RELATORIA | 437 |
| Senado Federal | DEFERIDA | 265 |
| Senado Federal | APROVADA | 216 |
| Senado Federal | AUDIÊNCIA PÚBLICA REALIZADA | 156 |
| Senado Federal | AGUARDANDO AUDIÊNCIA PÚBLICA | 119 |
| Senado Federal | VOTO ENCAMINHADO | 115 |
| Senado Federal | REQUERIMENTO APROVADO | 112 |
| Senado Federal | AGUARDANDO DESIGNAÇÃO DO RELATOR | 81 |
| Senado Federal | TRANSFORMADA EM NORMA JURÍDICA | 62 |
| Senado Federal | PRONTA PARA A PAUTA NA COMISSÃO | 59 |
| Senado Federal | SESSÃO REALIZADA | 54 |
| Senado Federal | AGUARDANDO DECISÃO DA MESA | 50 |
| Senado Federal | TRAMITAÇÃO ENCERRADA | 44 |
| Senado Federal | PRONTO PARA DELIBERAÇÃO DO PLENÁRIO | 30 |
| Senado Federal | RETIRADA PELO AUTOR | 27 |
| Senado Federal | PREJUDICADA | 26 |
| Senado Federal | MATÉRIA DESPACHADA | 23 |
| Senado Federal | ARQUIVADA | 18 |
| Senado Federal | INDICAÇÃO ENCAMINHADA | 18 |
| Senado Federal | TRANSFORMADA EM PROJETO DE RESOLUÇÃO DO SENADO | 18 |
| Senado Federal | REQUERIMENTO PREJUDICADO | 13 |
| Senado Federal | AGUARDANDO INCLUSÃO ORDEM DO DIA DE REQUERIMENTO | 12 |
| Senado Federal | APROVADO O REQUERIMENTO | 12 |
| Senado Federal | AGUARDANDO INFORMAÇÕES | 10 |
| Senado Federal | REMETIDA À CÂMARA DOS DEPUTADOS | 9 |
| Senado Federal | CONHECIDA | 7 |
| Senado Federal | PROVIDÊNCIA CONCLUÍDA | 7 |
| Senado Federal | REMETIDA À SANÇÃO | 6 |
| Senado Federal | SEM EFICÁCIA | 6 |
| Câmara dos Deputados | Aguardando Providências Internas | 4.099 |
| Câmara dos Deputados | Tramitação Finalizada | 2.451 |
| Câmara dos Deputados | Aguardando Remessa ao Arquivo | 1.913 |
| Câmara dos Deputados | Arquivada | 1.828 |
| Câmara dos Deputados | Pronta para Pauta | 1.519 |
| Câmara dos Deputados | Aguardando Despacho do Presidente da Câmara dos Deputados | 1.447 |
| Câmara dos Deputados | Aguardando Designação de Relator(a) | 1.382 |
| Câmara dos Deputados | Aguardando Resposta | 1.307 |
| Câmara dos Deputados | Aguardando Parecer | 1.175 |
| Câmara dos Deputados | Aguardando Despacho do Presidente da Câmara dos Deputados (Chancela) | 772 |
| Câmara dos Deputados | Tramitando em Conjunto | 685 |
| Câmara dos Deputados | Aguardando Encaminhamento | 530 |
| Câmara dos Deputados | Aguardando Autorização do Despacho | 332 |
| Câmara dos Deputados | Aguardando Despacho do Presidente da Câmara dos Deputados (Autorização) | 223 |
| Câmara dos Deputados | Aguardando Despacho - Requerimentos | 182 |
| Câmara dos Deputados | Retirado pelo(a) Autor(a) | 129 |
| Câmara dos Deputados | Aguardando Deliberação | 66 |
| Câmara dos Deputados | Aguardando Recurso | 62 |
| Câmara dos Deputados | Aguardando Chancela e Publicação do Despacho | 37 |
| Câmara dos Deputados | Transformado em Norma Jurídica | 34 |
| Câmara dos Deputados | Aguardando Despacho do Presidente da Câmara dos Deputados (Análise) | 33 |
| Câmara dos Deputados | Aguardando Apreciação pelo Senado Federal | 32 |
| Câmara dos Deputados | Aguardando Despacho do Presidente | 29 |
| Câmara dos Deputados | Ag. Análise de Inconstitucionalidade | 26 |
| Câmara dos Deputados | Aguardando Designação - Aguardando Devolução de Relator(a) que deixou de ser Membro | 17 |
| Câmara dos Deputados | Perdeu a Eficácia | 17 |
| Câmara dos Deputados | Aguardando Autógrafos na Mesa | 16 |
| Câmara dos Deputados | Aguardando Apensação | 8 |
| Câmara dos Deputados | Enviada ao Congresso Nacional | 7 |
| Câmara dos Deputados | Aguardando Análise de Parecer | 6 |

## Frescor da última atualização

A distribuição abaixo só usa proposições cuja data de atualização foi efetivamente preservada. Ausência de data não é convertida em data de apresentação ou de coleta.

| Casa | Com data de atualização | Primeira atualização registrada | Última atualização registrada | Com hora | Somente dia |
|---|---:|---|---|---:|---:|
| Senado Federal | 2.574 | 2026-01-21T14:19:50.304000 | 2026-09-17T07:17:25.394000 | 2.574 | 0 |
| Câmara dos Deputados | 36 | 2026-02-17T00:00 | 2026-09-04T00:00 | 36 | 0 |

## Limitações e próximos ajustes de dados

- O catálogo ativo do Senado contém muitas proposições históricas sem enriquecimento de processo; por isso, a cobertura de status do acervo inteiro é menor que a de 2026.
- O ETL anual da Câmara deve passar a persistir também `ultimoStatus.data` ou `ultimoStatus.dataHora`. Hoje a descrição está disponível em massa, mas a data da mudança não.
- `lastUpdated` informa atualização do registro/processo e não necessariamente a data em que o mérito foi decidido.
- Para estudar transições, deve-se ordenar `situation` e `movement` por `occurred_at`, preservando status atual e histórico como conceitos separados.
