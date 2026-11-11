# Contrato frontend P14.8

Rotas propostas: /judiciario, /judiciario/tribunais, /judiciario/tribunais/[id], /judiciario/stj/precedentes e /judiciario/stj/precedentes/[id]. O frontend consome somente os serviços P14.7, nunca fontes externas ou PostgreSQL direto.

Componentes devem renderizar disponibilidade, cobertura, denominadores, fórmula e data de referência; NULL, ausência, bloqueio e cobertura parcial não podem virar zero. O perfil pode mostrar finanças STJ somente quando disponíveis e jurisprudência STJ apenas no perfil STJ. A identidade visual segue Cívica #115B45. P14.7 não cria React nem CSS.
