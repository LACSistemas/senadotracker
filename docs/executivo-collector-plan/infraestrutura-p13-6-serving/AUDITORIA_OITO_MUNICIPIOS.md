# Auditoria do delta 5.569 × 5.561

A antiga consulta escolhia um único `min(ibge7)` por projeto; em obras multimunicipais isso descartava vínculos secundários. Não houve filtro financeiro ou exclusão de revisão. Os oito códigos recuperados no serving são:

`3107703` Bom Jesus do Amparo/MG; `3172202` Wenceslau Braz/MG; `3204302` Presidente Kennedy/ES; `4116505` Nova Aliança do Ivaí/PR; `4123600` Santa Inês/PR; `4126702` Tamboara/PR; `4219853` Zortéa/SC; `5107248` Santa Carmem/MT.

O rollup atual mede projeto×município e serve `WORK_MUNICIPALITIES_SERVING=5569`.
