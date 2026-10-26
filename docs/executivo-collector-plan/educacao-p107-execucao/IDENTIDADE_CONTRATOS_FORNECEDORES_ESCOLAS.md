# Identidade e vínculos (G5_CROSS_DOMAIN_LINKAGE): PASS_WITH_CAVEATS

Regra: só chave oficial. Sem fuzzy matching de CNPJ, órgão ou nome de escola. Mesmo CNPJ ou mesmo valor não prova vínculo contrato→pagamento.

| Relação | Chave | Situação |
|---|---|---|
| contrato ↔ contratação | `numeroControlePncpCompra` | só 2.030 contratações coletadas (de ~175 mil esperadas); o vínculo existe apenas onde a contratação foi coletada |
| contrato ↔ termos | `numeroControlePNCP` | só 6 contratos com termos coletados |
| contrato ↔ obra | `identificadorCipi` = `idUnico` do Obrasgov | 17.838 contratos com CIPI; 2 com obra já coletada |
| contrato ↔ fornecedor | CNPJ (PJ) | 100% dos contratos PJ ligam a `exec_fin_supplier`; PF omitida |
| contrato ↔ município/UF/Brasil | CNPJ do órgão + IBGE da unidade | município pelo **órgão contratante**, não pelo local da obra |
| contrato ↔ **escola** | (não existe) | **0 vínculos**: o PNCP e o Obrasgov não trazem INEP. Blocker provado; a leitura `getEduSchoolContracts` responde isso explicitamente |
| contrato ↔ empenho ↔ pagamento | (não existe) | **0 relações comprovadas**: PNCP não publica pagamento; Obrasgov traz empenho, não pago |
| Educação × Segurança | `pncp_id` | 995 contratos (R$ 170,8 mi) nos dois domínios: somar domínios exige dedupe por `pncp_id` |

Duplicidades: a chave `numeroControlePNCP` é única (431.788 ids únicos na varredura, sem repetição); retificação no mesmo ano ficaria com a última linha; 0 pares (órgão, ano, sequência) com duas chaves. Os 3.596 contratos a menos no banco são rejeitados por falta de município ou CNPJ do órgão, não duplicados.
