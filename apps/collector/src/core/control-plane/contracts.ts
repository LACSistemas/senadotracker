export const CONTROL_DOMAINS = ['IDENTITY', 'FINANCE', 'PERSONNEL', 'LEGISLATIVE', 'TIMELINE', 'BUDGET_AMENDMENTS'] as const;
export type ControlDomain = typeof CONTROL_DOMAINS[number];
export const CONTROL_HOUSES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'] as const;
export type ControlHouse = typeof CONTROL_HOUSES[number];
export type OperationalStatus = 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL' | 'PROVEN_EXTERNAL_BLOCKER' | 'EXECUTION_ENVIRONMENT_BLOCKED' | 'UPSTREAM_BLOCKER' | 'NOT_APPLICABLE';
export type ImplementationState = 'PRODUCTION_CAPABLE' | 'ADAPTER_REQUIRED' | 'ADAPTER_REQUIRED_WITH_PROVEN_INTERNAL_BLOCKER' | 'ONE_OFF_ONLY' | 'NO_IMPLEMENTATION' | 'BLOCKED_SOURCE' | 'MANUAL_ONLY' | 'MANUAL_ONLY_WITH_RUNBOOK' | 'NON_REPRODUCIBLE_LEGACY_PUBLICATION' | 'UNSAFE_TO_AUTOMATE' | 'UNSAFE_TO_AUTOMATE_WITH_PROVEN_REASON' | 'ENVIRONMENT_DEPENDENT';
export type ControlCollectionModel = 'SNAPSHOT' | 'CUMULATIVE_SNAPSHOT' | 'PARTITIONED_SNAPSHOT' | 'TRANSACTIONAL' | 'DOCUMENT_SERIES' | 'PAGINATED_API' | 'MIXED' | 'MANUAL_SOURCE_BOUNDARY';
export type SourceFrequency = 'HOURLY' | 'DAILY' | 'DAILY_D_MINUS_1' | 'WEEKLY' | 'MONTHLY' | 'SOURCE_DRIVEN' | 'IRREGULAR' | 'MANUAL' | 'UNKNOWN';
export type ControlOperation = 'status' | 'health' | 'validate' | 'collect' | 'refresh' | 'backfill' | 'replay' | 'preflight' | 'scheduler-tick';
export type RefreshMode = 'LIVE_SOURCE' | 'LIVE_SOURCE_WITH_CHECKPOINT' | 'LIVE_SOURCE_FULL_SNAPSHOT' | 'LIVE_SOURCE_PARTITIONED' | 'LIVE_SOURCE_INCREMENTAL' | 'REPLAY_ONLY' | 'VALIDATE_ONLY';
export type ControlResultStatus = 'SUCCESS' | 'NO_CHANGE' | 'VALID' | 'SOURCE_BLOCKED' | 'ENVIRONMENT_BLOCKED' | 'PARTIAL_SOURCE_BOUNDARY' | 'FAILED_SAFE' | 'INVALID_ARGUMENT' | 'UNSUPPORTED_OPERATION';

export interface ProviderCapabilities {
  readonly supportsCollect: boolean;
  readonly supportsRefresh: boolean;
  readonly supportsBackfill: boolean;
  readonly supportsReplay: boolean;
  readonly supportsCheckpoint: boolean;
  readonly supportsIncremental: boolean;
  readonly supportsFullBackfill: boolean;
  readonly schedulerEligible: boolean;
  readonly lastKnownGoodSupported: boolean;
}

export interface ProviderMetadata {
  readonly providerId: string | null;
  readonly house: ControlHouse;
  readonly domain: ControlDomain;
  readonly enabled: boolean;
  readonly operationalStatus: OperationalStatus;
  readonly implementationState: ImplementationState;
  readonly sourceAuthority: string;
  readonly collectionModel: ControlCollectionModel;
  readonly sourceUpdateFrequency: SourceFrequency;
  readonly capabilities: ProviderCapabilities;
  readonly rateLimitProfile: { readonly maxRequestsPerMinute: number | null; readonly maxConcurrency: number; readonly cooldownMs: number };
  readonly retryPolicy: { readonly retryableErrors: readonly string[]; readonly maxRetries: number; readonly backoffMs: number };
  readonly defaultTimeoutMs: number;
  readonly entrypoint: string | null;
  /** Explicit capability truth: collect/refresh must reach the source when LIVE_SOURCE. */
  readonly refreshMode?: RefreshMode;
  readonly sourceRuntimeEntrypoint?: string | null;
  readonly publicationAdapter?: string | null;
  readonly schedulerEligibleFuture?: boolean;
  readonly activePublicationSchema: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly sourceUpdatedAt: string | null;
  readonly dataThrough: string | null;
  readonly activeRevision: string | null;
  readonly healthStatus: 'HEALTHY_FRESH' | 'HEALTHY_STALE' | 'DEGRADED' | 'BLOCKED' | 'FAILED' | 'UNKNOWN';
  readonly notes: string;
  readonly evidence: readonly string[];
  /** Shared host/backend limiter key. Kept separate from provider metadata in persistence. */
  readonly sourceFamilyId?: string | null;
  readonly canRunManually?: boolean;
  /** Required when a valid publication is intentionally operator-driven. */
  readonly manualRunbook?: {
    readonly source: string;
    readonly command: string;
    readonly input: string;
    readonly validation: string;
    readonly publicationGate: string;
    readonly frequency: string;
    readonly operator: string;
  } | null;
}

export interface RunContext {
  readonly runId: string;
  readonly command: ControlOperation;
  readonly providerId: string;
  readonly house: ControlHouse;
  readonly domain: ControlDomain;
  readonly year: number | null;
  readonly startedAt: string;
  readonly database: string;
  readonly dryRun: boolean;
  readonly trigger: 'MANUAL_CLI' | 'SCHEDULER';
  readonly options: Readonly<Record<string, string | number | boolean | null>>;
}

export interface RunResult {
  readonly status: ControlResultStatus;
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly sourceRequests: number;
  readonly rawCaptured: number;
  readonly candidateCreated: number;
  readonly revisionCreated: boolean;
  readonly revisionActivated: boolean;
  readonly activeRevisionBefore: string | null;
  readonly activeRevisionAfter: string | null;
  readonly duplicateInsertions: number;
  readonly lastKnownGoodPreserved: boolean;
  readonly warnings: readonly string[];
  readonly error: { readonly classification: string; readonly message: string } | null;
}

export interface ProviderAdapter {
  readonly providerId: string;
  readonly sourceFamilyId?: string;
  readonly capabilities?: Partial<ProviderCapabilities>;
  readonly operations: Readonly<Partial<Record<ControlOperation, (context: RunContext) => Promise<Partial<RunResult>>>>>;
}

export interface ControlSelection { readonly house?: ControlHouse; readonly domain?: ControlDomain; readonly year?: number; readonly due?: boolean; readonly operational?: boolean; readonly blocked?: boolean; }
