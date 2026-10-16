import type {AxiosStatic, InternalAxiosRequestConfig} from 'axios';

// Opt-in diagnostic logging. Never include request URLs, headers, bodies or IDs.
export const isPerfTraceEnabled =
  process.env.EXPO_PUBLIC_PERF_TRACE === '1';

type TraceValue = string | number | boolean | undefined;
type TraceFields = Record<string, TraceValue>;

type DurationBucket = {
  phase: string;
  fields: TraceFields;
  count: number;
  totalMs: number;
  maxMs: number;
  samples: number[];
};

const durationBuckets = new Map<string, DurationBucket>();
let durationFlushTimer: ReturnType<typeof setTimeout> | undefined;
let navigationTrace:
  | {id: number; startedAt: number; provider: string; stages: Set<string>}
  | undefined;

const requestStarts = new WeakMap<
  InternalAxiosRequestConfig,
  {startedAt: number; requestId: number; service: string; route: string}
>();
let nextTraceId = 0;

export const perfNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export const perfTrace = (event: string, fields: TraceFields = {}) => {
  if (isPerfTraceEnabled) {
    console.info(`[VEGA_PERF] ${JSON.stringify({event, ...fields})}`);
  }
};

/** Summarize repeated synchronous work instead of logging every card or DB read. */
export const observePerfDuration = (
  phase: string,
  fields: TraceFields,
  durationMs: number,
) => {
  if (!isPerfTraceEnabled) {return;}
  const key = JSON.stringify([phase, fields]);
  let bucket = durationBuckets.get(key);
  if (!bucket) {
    bucket = {phase, fields, count: 0, totalMs: 0, maxMs: 0, samples: []};
    durationBuckets.set(key, bucket);
  }
  bucket.count += 1;
  bucket.totalMs += durationMs;
  bucket.maxMs = Math.max(bucket.maxMs, durationMs);
  if (bucket.samples.length < 128) {
    bucket.samples.push(durationMs);
  } else {
    bucket.samples[bucket.count % 128] = durationMs;
  }
  if (!durationFlushTimer) {
    durationFlushTimer = setTimeout(flushPerfDurations, 5000);
  }
};

export const flushPerfDurations = () => {
  if (durationFlushTimer) {
    clearTimeout(durationFlushTimer);
    durationFlushTimer = undefined;
  }
  if (!isPerfTraceEnabled) {return;}
  for (const bucket of durationBuckets.values()) {
    const ordered = [...bucket.samples].sort((a, b) => a - b);
    perfTrace('sync_summary', {
      phase: bucket.phase,
      ...bucket.fields,
      count: bucket.count,
      totalMs: Math.round(bucket.totalMs),
      maxMs: Math.round(bucket.maxMs),
      p95Ms: Math.round(ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))] || 0),
    });
  }
  durationBuckets.clear();
};

export const measurePerfSync = <T>(
  phase: string,
  fields: TraceFields,
  operation: () => T,
): T => {
  if (!isPerfTraceEnabled) {return operation();}
  const startedAt = perfNow();
  try {
    return operation();
  } finally {
    observePerfDuration(phase, fields, perfNow() - startedAt);
  }
};

export const startPerfNavigation = (provider: string) => {
  if (!isPerfTraceEnabled) {return;}
  navigationTrace = {
    id: ++nextTraceId,
    startedAt: perfNow(),
    provider,
    stages: new Set(),
  };
  perfTrace('info_navigation_start', {
    navigationId: navigationTrace.id,
    provider,
  });
};

export const markPerfNavigationStage = (stage: string) => {
  const trace = navigationTrace;
  if (!isPerfTraceEnabled || !trace || trace.stages.has(stage)) {return;}
  if (perfNow() - trace.startedAt > 30000) {
    navigationTrace = undefined;
    return;
  }
  trace.stages.add(stage);
  perfTrace('info_navigation_stage', {
    navigationId: trace.id,
    provider: trace.provider,
    stage,
    elapsedMs: Math.round(perfNow() - trace.startedAt),
  });
};

/** Detect JS event-loop stalls; do not mistake suspended background timers for jank. */
export const startPerfHeartbeat = () => {
  if (!isPerfTraceEnabled) {return () => {};}
  const intervalMs = 500;
  let expectedAt = perfNow() + intervalMs;
  const timer = setInterval(() => {
    const now = perfNow();
    const lagMs = now - expectedAt;
    if (lagMs >= 120 && lagMs < 5000) {
      perfTrace('js_lag', {durationMs: Math.round(lagMs)});
    }
    expectedAt = now + intervalMs;
  }, intervalMs);
  return () => clearInterval(timer);
};

export const startPerfSpan = (phase: string, fields: TraceFields = {}) => {
  if (!isPerfTraceEnabled) {
    return (_outcome?: string) => {};
  }
  const spanId = ++nextTraceId;
  const startedAt = perfNow();
  perfTrace('start', {spanId, phase, ...fields});
  return (outcome = 'ok') => {
    perfTrace('end', {
      spanId,
      phase,
      ...fields,
      outcome,
      durationMs: Math.round(perfNow() - startedAt),
    });
  };
};

export const traceAsync = async <T>(
  phase: string,
  fields: TraceFields,
  operation: () => Promise<T>,
): Promise<T> => {
  if (!isPerfTraceEnabled) {return operation();}
  const end = startPerfSpan(phase, fields);
  try {
    const result = await operation();
    end('ok');
    return result;
  } catch (error) {
    end('error');
    throw error;
  }
};

const classifyRequest = (url?: string, baseURL?: string) => {
  try {
    const parsed = new URL(url || '', baseURL || 'https://invalid.invalid');
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host.endsWith('animeunity.so')) {
      return {
        service: 'animeunity',
        route: path.startsWith('/info_api/')
          ? 'info_api'
          : path.startsWith('/anime/')
            ? 'anime_page'
            : 'catalog',
      };
    }
    if (host === 'api.themoviedb.org') {
      return {
        service: 'tmdb_api',
        route: path.includes('/season/')
          ? 'season'
          : path.includes('/search/')
            ? 'search'
            : 'other',
      };
    }
    if (host.endsWith('themoviedb.org')) {
      return {service: 'tmdb_web', route: 'page'};
    }
    if (host.endsWith('thetvdb.com')) {
      return {service: 'tvdb', route: 'page_or_api'};
    }
    if (host.includes('anibridge') || path.includes('/anibridge/')) {
      return {service: 'anibridge', route: 'mapping'};
    }
    if (host.includes('anizip') || host === 'api.ani.zip') {
      return {service: 'anizip', route: 'metadata'};
    }
    if (host.includes('cinemeta')) {
      return {service: 'cinemeta', route: 'metadata'};
    }
    if (host.includes('anilist')) {
      return {service: 'anilist', route: 'metadata'};
    }
    if (host.includes('jikan')) {
      return {service: 'jikan', route: 'metadata'};
    }
    if (host.includes('wikidata')) {
      return {service: 'wikidata', route: 'mapping'};
    }
    return {service: 'other', route: 'other'};
  } catch (_) {
    return {service: 'other', route: 'other'};
  }
};

export const installPerfAxiosTrace = (client: AxiosStatic) => {
  const tracedClient = client as AxiosStatic & {
    __vegaPerfTraceInstalled?: boolean;
  };
  if (!isPerfTraceEnabled || tracedClient.__vegaPerfTraceInstalled) {
    return;
  }
  tracedClient.__vegaPerfTraceInstalled = true;
  client.interceptors.request.use(config => {
    const target = classifyRequest(config.url, config.baseURL);
    const requestId = ++nextTraceId;
    requestStarts.set(config, {
      startedAt: perfNow(),
      requestId,
      ...target,
    });
    perfTrace('http_start', {requestId, ...target});
    return config;
  });

  const finishRequest = (
    config: InternalAxiosRequestConfig | undefined,
    status: number | string,
  ) => {
    if (!config) {
      return;
    }
    const trace = requestStarts.get(config);
    if (!trace) {
      return;
    }
    requestStarts.delete(config);
    perfTrace('http_end', {
      requestId: trace.requestId,
      service: trace.service,
      route: trace.route,
      status,
      durationMs: Math.round(perfNow() - trace.startedAt),
    });
  };

  client.interceptors.response.use(
    response => {
      finishRequest(response.config, response.status);
      return response;
    },
    error => {
      finishRequest(error?.config, error?.response?.status || 'network_error');
      return Promise.reject(error);
    },
  );
};
