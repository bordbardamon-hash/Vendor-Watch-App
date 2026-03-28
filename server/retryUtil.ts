interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  retryOn?: (error: Error, statusCode?: number) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 0,
  baseDelayMs: 500,
  maxDelayMs: 1500,
  jitterMs: 200,
  retryOn: () => false,
};

const FETCH_TIMEOUT_MS = 6000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitterMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = Math.random() * jitterMs;
  return cappedDelay + jitter;
}

function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  }, ms);
  timer.unref?.();
  return controller.signal;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let lastStatusCode: number | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: init?.signal || createTimeoutSignal(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        lastStatusCode = response.status;
        if (opts.retryOn(new Error(`HTTP ${response.status}`), response.status) && attempt < opts.maxRetries) {
          const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs, opts.jitterMs);
          console.log(`[retry] Attempt ${attempt + 1} failed (${response.status}), retrying in ${Math.round(delay)}ms`);
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (opts.retryOn(lastError, undefined) && attempt < opts.maxRetries) {
        const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs, opts.jitterMs);
        console.log(`[retry] Attempt ${attempt + 1} failed (${lastError.message}), retrying in ${Math.round(delay)}ms`);
        await sleep(delay);
        continue;
      }
      
      throw lastError;
    }
  }

  throw lastError || new Error(`Failed after ${opts.maxRetries + 1} attempts`);
}
