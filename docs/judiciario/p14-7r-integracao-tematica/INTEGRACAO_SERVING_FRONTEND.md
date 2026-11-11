# Integração com serving e contrato para P14.8

postgres-judiciary-themes.ts resolve primeiro a revisão metadata e, por provenance, consulta os fatos na revisão P14.6. Catálogo, overview, indicadores paginados, séries e comparadores filtram pela categoria canônica, não pelo prefixo histórico do ID. O serving expõe GENERAL_EXECUTION e CRIMINAL_EXECUTION separadamente de TAX_EXECUTION.

P14.8 deve consumir somente esses métodos server-side. Indicadores SUM podem ser agregados no universo declarado; taxas e índices retornam valor nulo no campo agregado e não viram ranking. Ausências permanecem nulas com cobertura explícita. Temas documentais/bloqueados podem aparecer como contexto metodológico, mas não como números.