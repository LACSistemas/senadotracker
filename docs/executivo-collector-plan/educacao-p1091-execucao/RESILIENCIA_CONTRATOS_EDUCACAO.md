# Resiliência dos contratos

Os contratos compactos retornam `null` quando o território/ano não tem materialização e preservam `coverage` por seção. Falha de uma fonte não é convertida em zero. O overview já contém flags de disponibilidade e timestamp de refresh.

O replace é transacional e protegido por advisory lock. O estado anterior continua íntegro se a transação falhar. Cache de dados imutáveis pode ser usado pelo serviço, mas não substitui `refreshedAt`, fingerprint, `through` ou last-known-good.

Limitação remanescente: o read model não faz fallback automático para uma versão histórica quando o refresh falha; isso deve ser conectado ao control plane antes da publicação pública.
