# Inventário existente

Consulta somente-leitura em 28/10/2026: `current_database()=projetoeleitor_db`, usuário `projetoeleitor_user`, tamanho aproximado 32 GB, 118 tabelas em `civica_exec`.

| Família | Evidência | Estado P12 | Reuso |
|---|---|---|---|
| Identidade territorial | `exec_entity`, `exec_entity_version`, `exec_entity_external_id` | EXISTING_OPERATIONAL | IBGE e hierarquia |
| População | `exec_territory_population` | EXISTING_OPERATIONAL | denominadores 2001–2026 |
| Indicadores | `exec_ind_def`, `exec_ind_value`, `exec_ind_latest` | EXISTING_OPERATIONAL | numerador/denominador/status |
| Saúde | `exec_sau_*`, domínio 1 | EXISTING_OPERATIONAL | contexto, sem duplicar |
| Finanças | `exec_fin_fact`, `exec_fin_cov`, `exec_fin_exec`, `exec_fin_dot` | EXISTING_OPERATIONAL | função e estágio |
| Contratos/transferências | `exec_fin_contract`, `exec_fin_transfer` | EXISTING_OPERATIONAL | vínculo documental |
| Educação | `exec_edu_*` | EXISTING_OPERATIONAL/PARCIAL | contexto; não reabrir |
| CAPES | `exec_capes_*` | EXISTING_OPERATIONAL | fora do núcleo P12 |
| Renda/Censo | sem tabela P12 | NEW_SOURCE_REQUIRED | IBGE/SIDRA |
| Emprego | sem tabela P12 | NEW_SOURCE_REQUIRED | MTE PDET |
| CadÚnico/benefícios | sem tabela P12 | NEW_SOURCE_REQUIRED | MDS/Portal |
| SUAS | sem tabela P12 | NEW_SOURCE_REQUIRED | Censo SUAS |
| Moradia/saneamento | sem tabela P12 | NEW_SOURCE_REQUIRED | IBGE/SINISA |
| Cultura/digital | sem tabela P12 | SOURCE_NOT_PROVEN | MUNIC/ESTADIC/Anatel/Cetic |

`D:\Civica\raw` já possui ibge (população SIDRA), siconfi, pncp, educação e saúde. Não há diretórios P12 de renda, MTE, MDS, SUAS ou SINISA. Não houve download volumoso.
