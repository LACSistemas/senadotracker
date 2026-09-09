# Contrato de identidade e temporalidade

Decisão de domínio para T014, fundamentada nas amostras de [Senado](../sources/senado-historico.md) e [Câmara](../sources/camara-historico.md), consultadas em 08/09/2026. O schema e os parsers foram implementados no bloco B em `packages/domain`, `packages/db` e `apps/collector`.

## Entidades e chaves

| Entidade | Identidade planejada | Significado |
| --- | --- | --- |
| Pessoa | ID interno opaco | Pessoa física, independente de Casa e legislatura |
| Identificador externo | `(fonte, tipo, valor)` único | Ex.: `senado/parlamentar/5672`, `camara/deputado/204554`; valor normalizado como string |
| Participação em mandato | ID interno + referência oficial contextualizada | Pessoa vinculada ao mandato; condição titular/suplente preservada |
| Exercício | ID interno + ID externo quando existir | Intervalo em que a pessoa efetivamente exerceu o cargo, sem presumir continuidade |
| Partido | Namespace + código/URI oficial | Sigla é atributo temporal, não chave global |
| Filiação / estado partidário | Pessoa, fonte, partido e evidência temporal | Distinguir filiação explícita do Senado de estado cadastral da Câmara |
| Candidatura | Fonte + eleição + chave oficial | Entidade futura, não confundir com pessoa ou mandato |

No Senado, preservar `CodigoMandato` associado à pessoa e `CodigoExercicio`. Na Câmara, `idLegislatura` não identifica um mandato individual: usar pessoa + legislatura + evidências de entrada/saída, sem inventar código oficial de mandato. A modelagem de cadeiras e substituições não pode colapsar pessoas pelo mesmo mandato.

## Junção de identidades

IDs iguais em namespaces diferentes não são iguais. Nunca fundir por nome, foto, UF ou partido. Manter correspondências com estado `candidate`, `confirmed`, `rejected` ou `ambiguous`, evidência e justificativa. Vínculo entre Casas/TSE exige referência oficial cruzada ou revisão documentada de evidências suficientes. Sem isso, os perfis ficam separados.

Chaves numéricas vindas de JSON devem ser inteiros seguros antes da conversão a string. Rejeitar valores que já perderam precisão. Não eliminar zeros à esquerda arbitrariamente em fontes futuras. Conservar valor original e representação normalizada.

## Tempo e estados

- Registrar `fetchedAt` em UTC separadamente das datas da fonte. Registrar hash da resposta e versão do parser/lote quando implementados.
- Datas do Senado permanecem datas civis. Fim ausente tem motivo `not_reported`; não substituir por hoje nem pela data final da legislatura.
- Eventos da Câmara permanecem data/hora civil sem offset; UTC só após fuso comprovado. Intervalos reconstruídos devem indicar regra e eventos de origem.
- Manter limites oficiais sem alteração. Inclusividade de término do Senado permanece por verificar; não calcular participação diária com essa hipótese oculta.
- Condição titular/suplente, situação de exercício e situação eleitoral são dimensões distintas. Um suplente pode estar exercendo e um titular pode estar licenciado.
- Ausência de um ID na lista atual não apaga a pessoa ou prova data de fim. Exige reconciliação com histórico.
- Nulo, campo ausente e estado desconhecido não são sinônimos de “fora de exercício”. Guardar original e classificação de disponibilidade.
- Alteração de partido no cadastro atual não modifica votos/despesas passados. Relatórios partidários declaram a referência temporal escolhida.

## Conflitos e publicação

Quando cadastro atual e histórico discordarem, manter ambos com origem e abrir divergência. Não escolher o último registro coletado como verdade universal. Um estado atual validado na lista pode ser publicado com seu instante de observação, enquanto a série histórica afetada fica parcial.

Antes de publicar: validar chaves únicas, vínculos existentes, ordenação temporal, datas reais, início/fim consistentes e conflitos de intervalos. Falha em uma pessoa/domínio pode colocá-lo em quarentena; perda de cobertura de lote exige revisão antes de substituir o cadastro inteiro.

## Casos verificados no bloco B

1. Senado: suplente 5936 em exercício, com titular 751 distinto e início de exercício posterior ao início do mandato.
2. Senado: 6336 com intervalos encerrados e outro sem fim, preservando causas de afastamento.
3. Senado: 5672 com mudança partidária e lacuna entre datas declaradas, sem preenchimento automático.
4. Câmara: 204554 com `Licença`, `Exercício`, `FIM_MANDATO` e evento posterior nulo; não ressuscitar exercício.
5. Mesma grafia de nome em fontes diferentes não confirma identidade; mesmo ID em fontes distintas não colide.
6. Histórico corrigido gera revisão rastreável, sem duplicar a pessoa nem perder evidência anterior.

Fixtures contêm dados públicos mínimos para demonstrar esses contratos. Não expor CPF, nascimento, contatos ou outros campos pessoais sem necessidade no produto; payloads brutos locais ficam fora do Git.
