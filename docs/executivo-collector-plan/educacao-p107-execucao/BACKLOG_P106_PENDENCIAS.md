# Backlog herdado da P10.6 (somente documentado; não absorvido pela P10.7)

| Pendência | Fonte | Evidência | Cobertura | Impacto | Próxima ação | Dependência | Armazenamento estimado | Prioridade |
|---|---|---|---|---|---|---|---|---|
| Backfill Portal da Transparência 2014–2024 | Portal da Transparência (transferências educacionais) | P10.6 cobriu só a janela recente | parcial | séries longas de repasses sem histórico | coletar por ano com espaçamento e chave de API | chave de API, limite de requisições | ~0,3–0,5 GB | média |
| PDDE Info nacional | PDDE Info/FNDE | só ES/amostra coletada | parcial | sem visão nacional por escola | operacionalizar coleta por UF | estabilidade do portal | ~0,2 GB | média |
| 9 erros HTTP 400 PDDE/ES | PDDE Info | log da P10.6 | 9 consultas | lacunas pontuais no ES | repetir com parâmetros corrigidos | nenhuma | desprezível | baixa |
| VAAF/VAAT/VAAR | FNDE/Fundeb | não publicado | 0% | indicadores de complementação ausentes | mapear tabelas oficiais | metodologia | < 0,05 GB | média |
| PNAE/PNATE específicos | FNDE | só categoria de contrato (8/9) | 0% repasse | sem repasse por programa | coletar repasses por entidade executora | chave de entidade | ~0,1 GB | média |
| 44 falhas de testes herdadas | suíte | agora 16 falhas, todas em testes P9 de migração/publicação (contagem de tabelas e fixtures) e nenhuma de educação | — | ruído de regressão | corrigir fixtures/contagens no escopo P9 | nenhuma | 0 | baixa |
| Divergência `productionTouched` da P10.6 | `results.json` da P10.6 | P10.6 gravou 563.288 linhas (v15 aplicada, datasets 112/113) e o JSON dizia "NO" | corrigida em nota | auditoria | anotar no relatório P10.6 | nenhuma | 0 | baixa |
