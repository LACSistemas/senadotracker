# Identidade institucional

`CO_IES` é a chave primária estável de `exec_edu_higher_ies`. Nome, sigla e mantenedora são atributos observados; não há fuzzy matching nem criação de entidade por nome. `CO_MANTENEDORA` permanece atributo source-native e não é confundido com a IES.

`exec_edu_higher_ies_year` preserva o fato anual: sede (`CO_MUNICIPIO_IES`), entidade territorial, UF, organização acadêmica, categoria administrativa, rede, docentes e técnicos. Nas três edições, 7.736 fatos IES-ano foram publicados e todos os municípios de sede observados resolveram para `exec_entity`.

2022 não possui `TP_REDE` no arquivo de IES. O parser reconciliou a rede diretamente do `TP_REDE` source-native do arquivo de cursos, por IES, inclusive a categoria administrativa 7 (Especial); não usa inferência textual por nome. A regra está versionada em `p112-2026-10-27-v3`.
