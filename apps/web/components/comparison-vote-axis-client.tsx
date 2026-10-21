'use client';

import { useEffect, useState } from 'react';
import type { VoteAxis } from '@senadotracker/db';
import { ComparisonVoteAxis } from '@/components/comparison-vote-axis';

export function ComparisonVoteAxisClient({ axis, highlights }: { axis: VoteAxis; highlights: Array<{ externalId: string; name: string; color: string }> }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <ComparisonVoteAxis axis={axis} highlights={highlights} /> : null;
}

