import { cache } from 'react';
import { readStateNumbersInput } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool';
import { computeStateNumbers, type StateLegislativeNumbers } from './state-numbers-compute';

export type { StateLegislativeNumbers };

/** Uma consulta agregada por requisição; vem dos agregados `civica_state_story` e da tabela de subsídios. */
export const getStateLegislativeNumbers = cache(async (): Promise<StateLegislativeNumbers | null> => {
  try { const input = await readStateNumbersInput(webPostgresPool()); return input.houses.length ? computeStateNumbers(input) : null; } catch (error) { console.error('state legislative numbers failed', error); return null; }
});
