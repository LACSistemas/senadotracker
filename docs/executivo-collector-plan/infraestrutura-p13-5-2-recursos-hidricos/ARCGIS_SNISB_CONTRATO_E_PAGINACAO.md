# Contrato ArcGIS SNISB

A camada declara maxRecordCount=2000, suporte a estatísticas e paginação. A estratégia final foi recuperar IDs completos e buscar objetos em lotes de 500 IDs, preservando URL, bytes e SHA-256 no manifesto em D:. A paginação por resultOffset foi considerada incompleta e não entrou no staging final.
