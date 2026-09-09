# Política de dados funcionais de gabinete

## Finalidade

Mostrar quem integra uma equipe parlamentar, em qual função pública e em qual snapshot oficial, permitindo compreender a estrutura do gabinete e auditar a atribuição dos gastos publicados.

## Campos publicáveis

- nome funcional publicado pelo órgão;
- Casa e gabinete vinculados com evidência;
- categoria de vínculo;
- cargo, função e descrição funcional;
- data de nomeação/admissão quando a fonte a fornece;
- empresa/contrato para terceirização, se já exibidos na página oficial;
- data do snapshot, competência, fonte e lote.

## Campos excluídos da interface

CPF, título eleitoral, documento, endereço residencial, telefone pessoal, e-mail pessoal, nascimento, dados bancários, descontos, salário líquido e qualquer coluna sem necessidade para explicar a função pública. Identificadores técnicos como ponto, matrícula e `fcodigo` ficam no banco/auditoria e não viram busca ou texto público.

## Regras de associação

Nome isolado não confirma vínculo. A associação prioriza identificador oficial e unidade inequívoca. Texto de lotação pode confirmar apenas quando reconciliado com cadastro oficial e sem colisão. Liderança, comissão, bloco, partido e unidade administrativa permanecem fora de um gabinete pessoal. Casos ambíguos são contados no relatório e omitidos do total atribuído.

## Tempo, busca e retenção

Um arquivo atual é snapshot; nomeação não prova permanência até hoje nem histórico anterior. A interface mostra a data observada e marca desatualização. Busca nominal, quando existir, opera somente sobre o recorte funcional visível. Respostas brutas permanecem locais e fora do Git; documentação publica esquema, hash e estatísticas sem replicar a base nominal.

