$names=@('P20.json','P20.md','P20_1.json','P20_1.md','P20_1_national_matrix.json','P20_1_schema_compatibility.md','P20_1_source_map.json')
foreach($name in $names){Copy-Item -LiteralPath (Join-Path 'C:\Projetos\senadotracker\artifacts' $name) -Destination (Join-Path 'C:\Projetos\civicadocs\artifacts' $name) -Force}
