# Publicação, replay e freshness— P14.2

Revisão ativa: `p142-jn-2026-20261104`. A publicação usa quatro snapshots CNJ (ZIP, base principal, dicionário e seções federais), parser `p14.2-v1`, hash semântico e last-known-good. A revisão estatística é transacional e separada das revisões de unidades da P14.1.

O coletor foi executado novamente com a mesma entrada após a carga. Resultado: **NO_CHANGE**; nenhuma nova observação, crosswalk, parity check ou revisão foi criada e o banco não cresceu no replay final. Falha futura de parser preserva a revisão ativa e o RAW.
