# Plano incremental

1. No refresh, baixar o ZIP anual oficial para `D:\Civica\raw\inep\censo_superior` e calcular SHA antes de parsear.
2. Se SHA e parser não mudaram, retornar `no_change`.
3. Se mudaram, criar run novo, preservar o anterior e processar a edição completa afetada; o Censo é publicação anual, não delta por linha.
4. Validar cardinalidade da chave final, município/UF, somas e status antes de atualizar o serving territorial.
5. Registrar `data_through` como 31/12 do ano observado, nunca como data futura.
6. Acrescentar edições históricas somente após repetir o mesmo contrato e fechar Sinopse.

Scheduler não foi ativado nesta fase.
