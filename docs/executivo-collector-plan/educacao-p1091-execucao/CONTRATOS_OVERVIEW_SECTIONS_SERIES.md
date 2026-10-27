# Contratos compactos

| Contrato | Queries | Payload medido | Meta | Estado |
|---|---:|---:|---:|---|
| Overview Brasil | 1 | 11.613 B | 100 KB / 150 ms | PASS |
| Overview UF SP | 1 | 12.912 B | 100 KB / 100 ms | PASS |
| Overview município grande | 1 | 759 B | 100 KB / 100 ms | PASS |
| Overview município pequeno | 1 | 745 B | 100 KB / 75 ms | PASS |
| Comparação município/UF/Brasil | 3 | 24.312 B | 100 KB / 100 ms | PASS |
| Seção financeira UF | 1 | 9.870 B | 150 ms | PASS |
| Série Brasil | 1 | 3.003 B | 200 ms | PASS |
| Lista escolar paginada | 1 | 2.307 B | 200 ms | PASS |

`getEducationSection` retorna somente uma família compacta do overview; detalhamentos extensos devem ser contratos de lista/série específicos. A composição de comparação é explícita e descritiva, sem ranking.
