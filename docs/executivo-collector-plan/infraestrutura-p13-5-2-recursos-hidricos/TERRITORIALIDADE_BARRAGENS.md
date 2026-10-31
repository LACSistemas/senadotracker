# Territorialidade

Resolução municipal usa primeiro CDMUN/IBGE; para SNISB e ANM, aplica normalização exata de nome + UF contra `exec_entity`, aceitando somente correspondência única. Não há fallback fuzzy. Registros sem correspondência conservam município/UF source-native e `ibge7=NULL`. Atlas usa CDMUN diretamente.
