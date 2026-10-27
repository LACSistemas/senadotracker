# Instituições, ofertas e cursos

## Evidência já disponível no P10

- Censo Superior: ZIPs 1995–2024, aproximadamente 750 MB.
- 2024: arquivo IES com 84 colunas e cursos com 223 colunas.
- 2023: 2.580 linhas e 2.580 CO_IES distintos; 671.610 linhas de cursos; 46.317 códigos CO_CURSO distintos.
- A chave (CO_IES, CO_CURSO, CO_MUNICIPIO, TP_MODALIDADE_ENSINO) teve 461 duplicatas em 2023; há dimensão adicional a esclarecer.

## Identidade canônica

| Entidade | Chave recomendada | Observação |
|---|---|---|
| IES | CO_IES | instituição, sede e atributos institucionais |
| mantenedora | CO_MANTENEDORA | não confundir com IES |
| oferta de curso | CO_IES + CO_CURSO + CO_MUNICIPIO + TP_MODALIDADE_ENSINO + dimensões adicionais | linha do CSV não é automaticamente curso |
| município sede | CO_MUNICIPIO_IES | vem no arquivo IES |
| município de oferta | CO_MUNICIPIO | vem no arquivo de cursos |
| município polo EaD | localizar conforme registro de oferta | não inferir da sede |

## Semântica

QT_VG_*, QT_INSCRITO_*, QT_ING_*, QT_MAT_* e QT_CONC_* são medidas agregadas. Matrículas são vínculos aluno–curso; não devem ser somadas para declarar pessoas únicas. Graduação, pós-graduação lato sensu e stricto sensu devem permanecer em famílias distintas.

## Reuso P10

Reutilizar exec_entity para municípios/UF, contratos de snapshot e cobertura do P10. Não criar uma segunda taxonomia territorial nem usar exec_edu_school para IES.

