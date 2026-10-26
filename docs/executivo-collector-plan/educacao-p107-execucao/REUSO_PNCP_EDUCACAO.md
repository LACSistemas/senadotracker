# Reuso do PNCP na P10.7 (G1_PNCP_REUSE)

**Resultado: PASS.** Nenhum contrato foi baixado de novo. A educação saiu do RAW do PNCP que já estava em `D:\Civica\raw\pncp\contratos`.

| Item | Valor | Evidência |
|---|---|---|
| Contratos no RAW (páginas da API, verbatim) | 5.111.306 | `evidencias/pncp_raw_inventario.json`, varredura `evidencias/edu_scan_v9.json` |
| Período | 2021 a 2026 (jan–out/2026) | idem |
| Contratos no banco antes (Segurança) | ~165 mil (`exec_fin_contract`) | fingerprints |
| Contratos educacionais únicos publicados | **428.192** | `reconciliacao_producao.json` |
| Contratos classificados pela varredura | 431.788 (3.596 sem município ou CNPJ do órgão, rejeitados na publicação e contados) | `exec_edu_ctr_cov.rejected` |
| Ensino superior excluído do núcleo | 366.199 contratos | `edu_scan_v9.json` |

Por que as tabelas de educação são separadas (`exec_edu_contract*`) e não uma extensão de `exec_fin_contract`: o escopo de publicação de Segurança (UF × ano) teria colidido; 995 contratos (R$ 170,8 milhões) existem nas duas tabelas e **devem ser deduplicados por `pncp_id`** ao somar domínios.

## O que NÃO veio do RAW existente
- Contratação (compra), termos aditivos e obras: o contrato do PNCP não traz esses dados. Foram coletados à parte (D:), com cobertura pendente declarada. Ver `CONTRATOS_OBRAS_ESCOLARES.md`.
- O PNCP aplica limite de requisições (429): o coletor se autorregulou para ~0,3 requisição/s. Por isso a coleta complementar é parcial.

## RAW novo desta onda (em D:, sem teto)
| Pasta | Tamanho |
|---|---|
| `raw/pncp/compras` + `raw/pncp/termos` | ~0,1 GB (parcial) |
| `raw/obrasgov` | ~7 MB (parcial) |
| `staging/obras` (listas e amostras de auditoria) | ~1 GB |
