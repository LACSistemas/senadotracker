# Relatório de execução P13.5.2

## Resultado

P13.5.2 foi operacionalizada no banco `projetoeleitor_db` com três trilhos independentes: ANA/SNISB, ANM/SIGBM e Atlas Águas ISH-U. O status é **PASS_WITH_DOCUMENTED_SOURCE_LIMITATION**: as fontes e os dados foram publicados, mas a resolução territorial por nome+UF não é completa em todos os registros e a interseção entre chaves SNISB/SIGBM foi zero.

## Volume

- SNISB: 28835 linhas canônicas.
- SIGBM: 909 linhas.
- Atlas: 5572 municípios.
- Indicadores: 13 definições, 14875 observações.

## Segurança

RAW/staging ficam em D:, o envelope de armazenamento foi medido e o frontend permaneceu intocado. P13.5.3 não foi iniciado.
