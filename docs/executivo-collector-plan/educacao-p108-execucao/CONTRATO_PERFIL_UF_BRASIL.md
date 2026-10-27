# Contrato dos perfis de UF e Brasil

Leituras: `getEducationStateProfile` e `getEducationNationalProfile`. Usam agregados oficiais quando existem. Escolas e matrículas têm contagens próprias; docentes distintos vêm da Sinopse; Ideb/Saeb/fluxo vêm do grão territorial oficial.

Contratações usam `exec_edu_contract_rollup`, compacto e reconstruível. Categoria `0` representa contratos únicos; `1..16` são não aditivas. `POSSIBLE_EDUCATION` nunca entra no total principal. O metadado expõe horário, contagens e fingerprint da origem.

UF coletada tem obras `AVAILABLE`; UF não coletada recebe `NOT_COLLECTED`, nunca zero; Brasil recebe `PARTIAL` e nenhum total nacional, pois somente 9 UFs foram coletadas. Séries extensas são desabilitadas por padrão.

