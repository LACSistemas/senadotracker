import { cache } from 'react';
import { getStateLegislatorProfile } from './state-product';

/** Um perfil por requisição: generateMetadata e a página compartilham a mesma consulta. */
export const getCachedStateProfile = cache((house: string, id: string) => getStateLegislatorProfile(house, id));
