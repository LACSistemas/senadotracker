import { cache } from 'react';
import { after } from 'next/server';
import { readStateHouseStory, reconcileStateHouseStories } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool';

/**
 * Agregados já calculados da Casa (`civica_state_story.house_story`): 2 consultas pequenas por requisição, deduplicadas no render.
 * Se estiverem defasados em relação às revisões ativas (ou ainda não existirem), a página serve o que há e, DEPOIS de responder,
 * dispara a reconciliação da Casa (com trava consultiva, então visitas simultâneas não recalculam em duplicidade). Assim a página
 * se corrige sozinha qualquer que seja o caminho que publicou a revisão.
 */
export const getStateHouseStory = cache(async (house: string) => {
  const pool = webPostgresPool();
  const story = await readStateHouseStory(pool, house);
  if (!story.fresh) after(async () => { try { await reconcileStateHouseStories(pool, { houses: [house] }); } catch (error) { console.error(`state-story reconcile failed for ${house}`, error); } });
  return story;
});

/** Abaixo disso, ranquear deputados ou partidos por gasto/autoria exibiria só uma parte da Casa como se fosse o todo. */
export const MIN_LINKED_PCT = 80;
