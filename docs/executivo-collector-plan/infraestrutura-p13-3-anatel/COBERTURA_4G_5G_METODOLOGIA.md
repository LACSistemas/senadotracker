# Cobertura 4G/5G e metodologia

O piloto Mosaico baixado é um shapefile de uma previsão 4G da Claro em limiar `-110 dBm`. O SHP tem shape type 5 (polígono multipart), CRS WGS84 e uma única feição; DBF contém apenas `OID`. O arquivo representa sinal teórico, não população coberta, domicílios, acessos, qualidade ou disponibilidade efetiva.

Consequentemente, o piloto não foi transformado em indicador municipal. Qualquer publicação futura exige interseção territorial oficial, denominador populacional/municipal e regra explícita por tecnologia, operador e limiar.
