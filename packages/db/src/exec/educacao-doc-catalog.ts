/** Colunas da tabela exec_edu_doc_terr (docentes distintos oficiais da Sinopse Estatística; ver educacao-doc-build.ts). Módulo sem dependências para poder ser importado por specs e DDL. */
export const DOC_COLS = ['doc_total', 'doc_inf', 'doc_cre', 'doc_pre', 'doc_fun', 'doc_ai', 'doc_af', 'doc_med', 'doc_pub', 'doc_fed', 'doc_est', 'doc_mun', 'doc_priv', 'doc_urb', 'doc_rur'];
export const DOC_LABELS: Record<string, string> = {
  doc_total: 'Docentes da educação básica (distintos)', doc_inf: 'Educação infantil', doc_cre: 'Creche', doc_pre: 'Pré-escola', doc_fun: 'Ensino fundamental', doc_ai: 'Anos iniciais', doc_af: 'Anos finais', doc_med: 'Ensino médio',
  doc_pub: 'Rede pública', doc_fed: 'Rede federal', doc_est: 'Rede estadual', doc_mun: 'Rede municipal', doc_priv: 'Rede privada', doc_urb: 'Escolas urbanas', doc_rur: 'Escolas rurais',
};
