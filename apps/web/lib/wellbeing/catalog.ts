/** Catálogo dos 27 indicadores de Bem-estar (domain=4), confirmado contra `civica_exec.exec_ind_def` real. IDs e códigos são estáveis; usar sempre por id numérico e resolver o código a partir da observação já carregada. */
export const IND = {
  incomeMean: 9001, incomeMedian: 9002, gini: 9003, waterOk: 9004, sewerOk: 9005, garbageOk: 9006,
  cras: 9101, crasCap2500: 9102, crasCap3500: 9103, crasCap5000: 9104, idcrasMean: 9105, idcrasRespondents: 9106,
  creas: 9201, idcreasMean: 9202, idcreasRespondents: 9203, idconselhoMean: 9301,
  raisStock: 9401, raisRemuneration: 9402,
  cagedStock: 9500, cagedAdm: 9501, cagedDis: 9502, cagedBal: 9503,
  municDigitalService: 9601, municWebsiteActive: 9602, municMobileWebsite: 9603, municWifiPublic: 9604, municWifiWhole: 9605,
} as const;

export const MUNIC_DIGITAL_IDS = [IND.municDigitalService, IND.municWebsiteActive, IND.municMobileWebsite, IND.municWifiPublic, IND.municWifiWhole] as const;
