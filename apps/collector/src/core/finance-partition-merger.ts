export type PartitionedRow = {
  partitionKey: string;
  naturalKey: string;
};

export type CandidateMergeOptions<T extends PartitionedRow> = {
  previousActive: readonly T[];
  observedPartitions: ReadonlyMap<string, readonly T[]>;
  removalSemantics: 'carry-forward-unobserved-partitions' | 'source-absence-is-removal';
};

/**
 * Builds a candidate corpus without treating an unobserved partition as a
 * deletion. A partition replacement is scoped to the partition observed by
 * the current request; rows from other partitions are carried forward.
 */
export function buildCandidateCurrentCorpus<T extends PartitionedRow>({
  previousActive,
  observedPartitions,
  removalSemantics,
}: CandidateMergeOptions<T>): T[] {
  const observedKeys = new Set(observedPartitions.keys());
  const carried = removalSemantics === 'carry-forward-unobserved-partitions'
    ? previousActive.filter(row => !observedKeys.has(row.partitionKey))
    : [];
  const candidate = [...carried, ...[...observedPartitions.values()].flat()];
  const emptyPartition = candidate.find(row => !row.partitionKey.trim());
  if (emptyPartition) throw new Error('partition key must not be empty');
  const keys = new Set<string>();
  for (const row of candidate) {
    if (!row.naturalKey.trim()) throw new Error('natural key must not be empty');
    if (keys.has(row.naturalKey)) throw new Error(`duplicate natural key: ${row.naturalKey}`);
    keys.add(row.naturalKey);
  }
  return candidate;
}
