# Contrato de equivalência

Cada comparação deve declarar `fonte → filtro → grão → agregação → célula da Sinopse`. IES/cursos usam `count(distinct co_ies/co_curso)`; matrículas, ingressantes, concluintes e vagas são somados no grão da oferta. Dimensão 1/2 é territorializada e 3/4 não territorializada/nacional conforme o dicionário da edição. Sem a Sinopse baixada, campos externos ficam `NA`.
