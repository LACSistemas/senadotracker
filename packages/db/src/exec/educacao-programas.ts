export const EDUCATION_PROGRAM_ACTIONS = Object.freeze({ PDDE: '0515', PNAE: '00PI', PNATE: '0969', FUNDEB_COMPLEMENT: '00SB' } as const);
export const EDUCATION_FINANCIAL_STAGES = Object.freeze(['DUE', 'TRANSFERRED', 'RECEIVED', 'COMMITTED', 'LIQUIDATED', 'PAID', 'BALANCE', 'ACCOUNTABILITY'] as const);
export type EducationFinancialStage = typeof EDUCATION_FINANCIAL_STAGES[number];
export function isEducationProgramAction(value: string): value is (typeof EDUCATION_PROGRAM_ACTIONS)[keyof typeof EDUCATION_PROGRAM_ACTIONS] { return Object.values(EDUCATION_PROGRAM_ACTIONS).includes(value as any); }
