# Dicionário CRAS 2024

O dicionário oficial contém as abas `Dados Gerais` e `RH`. Somente `Dados Gerais` foi processada.

| Campo | Semântica usada | Tratamento |
|---|---|---|
| `NU_IDENTIFICADOR` | identificador source-native do CRAS | obrigatório, único; não exposto como pessoa |
| `IBGE` | código municipal de seis dígitos | preservado para auditoria |
| `IBGE7` | código territorial de sete dígitos | chave de junção com `civica_exec.exec_entity` |
| `UF`, `Município` | contexto territorial | descritivo; não usado como chave |
| `q1` | capacidade de referenciamento do CRAS | categorias 2.500, 3.500 e 5.000; texto normalizado por regra explícita |
| `Q_incompleto` | completude do registro | `completo`/`incompleto`; incompletos recebem `flags=4` |
| `q4` | situação do imóvel | não publicado como indicador nesta onda |
| `q2_1`, `q2_2` | horários de funcionamento | preservados somente no RAW; não publicados |

O leia-me oficial informa 8.547 observações originais, remoção de uma duplicata e incorporação de 59 casos quase completos, resultando em 8.546 linhas finais. Identificadores de responsáveis foram excluídos pela fonte.

IDCRAS, IDCREAS e IDConselho são publicados em planilhas oficiais separadas. Seus scores municipais foram ingeridos como valores publicados; RH não foi misturado nem usado para recalcular médias.
