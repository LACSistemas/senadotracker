# Reconciliação de programas e municípios

## Paridade observada

- fatos `portal_transferencias`: **563.222**;
- códigos municipais distintos: **5.567**;
- fatos com código municipal: **473.675**;
- fatos ligados deterministicamente: **471.356**;
- entidades municipais ligadas: **5.537**;
- fatos sem vínculo: **2.319** (linhas associadas aos 30 códigos sem resolução ou sem candidato);
- soma source `amount_cents`: **6.581.406.260.075**;
- soma dos fatos ligados: **5.416.059.247.155**;
- rollup publicado: **141.006** linhas.

As somas são mantidas em centavos inteiros. Não houve atualização dos fatos originais nem substituição de valor por zero. A diferença entre a soma source e a soma vinculada é a parcela sem identidade municipal canônica; ela não é descartada do armazenamento factual e não é apresentada como município.

Refresh do rollup é idempotente: duas execuções consecutivas produziram 5.567 linhas de mapa, os mesmos 5.537 vínculos e o mesmo total source.
