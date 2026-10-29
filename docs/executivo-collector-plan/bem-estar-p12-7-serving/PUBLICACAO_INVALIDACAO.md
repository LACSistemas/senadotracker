# Publicação, invalidação e last-known-good

O read layer consulta `exec_publication.state=1` e o `run_id` associado. Uma nova revisão só deve ser ativada após validação de esquema, contagem, cobertura e procedência. Em caso de falha, a publicação anterior permanece ativa; candidato incompleto não substitui o last-known-good.

O estado ativo foi auditado para os datasets 120–124: 28, 28, 84, 224 e 27 fatias ativas respectivamente; todas as publicações ativas apontam para runs com status publicado. Há runs históricos publicados sem fatia ativa correspondente, o que é esperado no modelo de revisão e não é servido pelo read layer.

Invalidar uma revisão exige mudança comprovada de fonte, hash, edição, semântica ou territorialidade. A invalidação deve registrar motivo e manter a procedência anterior. Nenhum refresh foi disparado em P12.7.
