type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  halfOpenCallCount: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60 * 1000,
  halfOpenMaxCalls: 2,
};

const circuits = new Map<string, CircuitBreakerState>();
const configs = new Map<string, CircuitBreakerConfig>();

function getState(name: string): CircuitBreakerState {
  let state = circuits.get(name);
  if (!state) {
    state = {
      state: 'closed',
      failureCount: 0,
      lastFailureAt: 0,
      lastSuccessAt: 0,
      halfOpenCallCount: 0,
    };
    circuits.set(name, state);
  }
  return state;
}

function getConfig(name: string): CircuitBreakerConfig {
  return configs.get(name) || DEFAULT_CONFIG;
}

export function configureCircuitBreaker(name: string, config: Partial<CircuitBreakerConfig>): void {
  configs.set(name, { ...DEFAULT_CONFIG, ...config });
}

export function isCircuitOpen(name: string): boolean {
  const state = getState(name);
  const config = getConfig(name);

  if (state.state === 'closed') return false;

  if (state.state === 'open') {
    const elapsed = Date.now() - state.lastFailureAt;
    if (elapsed >= config.resetTimeoutMs) {
      state.state = 'half-open';
      state.halfOpenCallCount = 0;
      console.log(`[circuit-breaker] ${name}: transitioning from OPEN to HALF-OPEN`);
      return false;
    }
    return true;
  }

  if (state.state === 'half-open') {
    return state.halfOpenCallCount >= config.halfOpenMaxCalls;
  }

  return false;
}

export function recordSuccess(name: string): void {
  const state = getState(name);
  state.lastSuccessAt = Date.now();

  if (state.state === 'half-open') {
    state.state = 'closed';
    state.failureCount = 0;
    state.halfOpenCallCount = 0;
    console.log(`[circuit-breaker] ${name}: HALF-OPEN -> CLOSED (recovered)`);
  } else {
    state.failureCount = 0;
  }
}

export function recordFailure(name: string): void {
  const state = getState(name);
  const config = getConfig(name);

  state.failureCount++;
  state.lastFailureAt = Date.now();

  if (state.state === 'half-open') {
    state.state = 'open';
    console.log(`[circuit-breaker] ${name}: HALF-OPEN -> OPEN (failed again)`);
    return;
  }

  if (state.failureCount >= config.failureThreshold) {
    state.state = 'open';
    console.log(`[circuit-breaker] ${name}: CLOSED -> OPEN after ${state.failureCount} failures`);
  }
}

export function getCircuitStatus(name: string): { state: CircuitState; failureCount: number; lastFailureAt: number; lastSuccessAt: number } {
  const state = getState(name);
  isCircuitOpen(name);
  return {
    state: state.state,
    failureCount: state.failureCount,
    lastFailureAt: state.lastFailureAt,
    lastSuccessAt: state.lastSuccessAt,
  };
}

export function getAllCircuitStatuses(): Record<string, { state: CircuitState; failureCount: number }> {
  const result: Record<string, { state: CircuitState; failureCount: number }> = {};
  for (const [name] of circuits) {
    const status = getCircuitStatus(name);
    result[name] = { state: status.state, failureCount: status.failureCount };
  }
  return result;
}
