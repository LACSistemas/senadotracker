import type { Row } from './publication.ts';

/**
 * Complementos do PNCP para os contratos educacionais (P10.7): a CONTRATAÇÃO (compra/licitação) de cada contrato e os TERMOS (aditivos, apostilamentos, rescisões).
 * Estimado ≠ homologado ≠ contratado ≠ pago: o valor homologado é o da compra; o do contrato é `valor_global` em exec_edu_contract. Valor ausente ou sigiloso fica NULL (nunca zero).
 * Nada aqui liga contrato a pagamento. Versionar EDU_COMPLEMENT_VERSION ao mudar qualquer regra.
 */
export const EDU_COMPLEMENT_VERSION = { parse: 'edu-compl-v1', publish: 'edu-compl-pub-1' } as const;
export interface PncpCompra {
  numeroControlePNCP?: string; anoCompra?: number; valorTotalEstimado?: number | null; valorTotalHomologado?: number | null; orcamentoSigilosoCodigo?: number | null;
  modalidadeId?: number | null; modoDisputaId?: number | null; situacaoCompraId?: number | null; srp?: boolean | null; dataPublicacaoPncp?: string | null; dataAberturaProposta?: string | null; dataEncerramentoProposta?: string | null;
  existeResultado?: boolean | null; objetoCompra?: string | null; orgaoEntidade?: { cnpj?: string } | null;
}
export interface PncpTermo {
  sequencialTermoContrato?: number | null; tipoTermoContratoNome?: string | null; dataAssinatura?: string | null; dataVigenciaFim?: string | null; valorAcrescido?: number | null; valorGlobal?: number | null; prazoAditadoDias?: number | null;
  qualificacaoAcrescimoSupressao?: boolean | null; qualificacaoVigencia?: boolean | null; qualificacaoReajuste?: boolean | null; qualificacaoFornecedor?: boolean | null; objetoTermoContrato?: string | null;
}
const day = (s: string | null | undefined): string | null => s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
const cents = (v: number | null | undefined): number | null => v == null || !Number.isFinite(v) || v < 0 ? null : Math.round(v * 100);
const clean = (s: string | null | undefined, n: number): string => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Linha da contratação. `ref` = contrato educacional que a referencia (UF da fatia e ente). Sigilo (código ≠ 1) zera o valor estimado e o homologado para NULL. */
export function buildProcurement(c: PncpCompra, ref: { uf: number; entity_id: number }): Row | { drop: 'sem_chave' | 'sem_cnpj_orgao' | 'sem_ano' } {
  if (!c.numeroControlePNCP) return { drop: 'sem_chave' };
  const cnpj = c.orgaoEntidade?.cnpj ?? ''; if (!/^\d{14}$/.test(cnpj)) return { drop: 'sem_cnpj_orgao' };
  const year = Number(c.anoCompra); if (!Number.isInteger(year) || year < 2000 || year > 2100) return { drop: 'sem_ano' };
  const sig = c.orcamentoSigilosoCodigo != null && c.orcamentoSigilosoCodigo !== 1;
  return {
    compra: c.numeroControlePNCP, year, uf: ref.uf, entity_id: ref.entity_id, org_cnpj: Number(cnpj), modalidade: c.modalidadeId ?? null, modo_disputa: c.modoDisputaId ?? null, situacao: c.situacaoCompraId ?? null, srp: c.srp ?? null,
    valor_estimado: sig ? null : cents(c.valorTotalEstimado), valor_homologado: sig ? null : cents(c.valorTotalHomologado), sigiloso: sig, pub_date: day(c.dataPublicacaoPncp), open_date: day(c.dataAberturaProposta), close_date: day(c.dataEncerramentoProposta),
    has_result: c.existeResultado ?? null, objeto: clean(c.objetoCompra, 600),
  };
}
export function buildTerm(pncpId: string, year: number, uf: number, t: PncpTermo): Row | null {
  const seq = Number(t.sequencialTermoContrato); if (!Number.isInteger(seq) || seq < 0 || seq > 32000) return null;
  return {
    pncp_id: pncpId, seq, year, uf, kind: clean(t.tipoTermoContratoNome, 80) || 'não informado', signed: day(t.dataAssinatura), vig_end: day(t.dataVigenciaFim), valor_acrescido: cents(t.valorAcrescido), valor_global: cents(t.valorGlobal),
    prazo_dias: t.prazoAditadoDias != null && Number.isFinite(t.prazoAditadoDias) ? Math.round(t.prazoAditadoDias) : null, q_valor: t.qualificacaoAcrescimoSupressao === true, q_vigencia: t.qualificacaoVigencia === true, q_reajuste: t.qualificacaoReajuste === true, q_fornecedor: t.qualificacaoFornecedor === true,
    objeto: clean(t.objetoTermoContrato, 500),
  };
}
