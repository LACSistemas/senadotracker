# Plano de download executado

Coletor: `scripts/exec/p135_national_collect.ts`.

Comando de inicialização/retomada:

```text
npx.cmd tsx scripts/exec/p135_national_collect.ts
```

O coletor usa GETs oficiais, páginas de 200, concorrência controlada 24, timeout de 90 s, até cinco tentativas, escrita atômica de cada página e retomada por arquivo/checkpoint. A última página parcial é aceita (`page_size <= 200`). Não há consulta por projeto; os recursos relacionados foram baixados integralmente e conciliados localmente.
