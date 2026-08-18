export interface RateLimitPolicy {
  maxAttempts: number;
  windowMs: number;
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

interface TimestampStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const fallbackStorage = new Map<string, string>();
const safeSessionStorage = (): TimestampStorage => {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // Privacy modes can deny browser storage. The in-memory fallback still
    // coalesces attempts for the life of this page without storing identity data.
  }
  return {
    getItem: (key) => fallbackStorage.get(key) ?? null,
    setItem: (key, value) => { fallbackStorage.set(key, value); },
    removeItem: (key) => { fallbackStorage.delete(key); },
  };
};

export class BrowserRateLimiter {
  constructor(private readonly storage: TimestampStorage, private readonly now: () => number = () => Date.now()) {}

  claim(key: string, policy: RateLimitPolicy): RateLimitDecision {
    const now = this.now();
    const cutoff = now - policy.windowMs;
    const timestamps = this.read(key).filter((timestamp) => timestamp >= cutoff && timestamp <= now);

    if (timestamps.length >= policy.maxAttempts) {
      this.write(key, timestamps);
      return { allowed: false, retryAfterMs: Math.max(1, timestamps[0] + policy.windowMs - now) };
    }

    timestamps.push(now);
    this.write(key, timestamps);
    return { allowed: true };
  }

  reset(key: string) {
    this.storage.removeItem(key);
  }

  private read(key: string): number[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(key) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
        : [];
    } catch {
      return [];
    }
  }

  private write(key: string, timestamps: number[]) {
    this.storage.setItem(key, JSON.stringify(timestamps));
  }
}

export const LOGIN_ATTEMPT_POLICY: RateLimitPolicy = { maxAttempts: 5, windowMs: 10 * 60 * 1000 };
const LOGIN_ATTEMPT_KEY = 'project-hub:login-attempts:v1';
const loginLimiter = new BrowserRateLimiter(safeSessionStorage());

export const claimLoginAttempt = () => loginLimiter.claim(LOGIN_ATTEMPT_KEY, LOGIN_ATTEMPT_POLICY);
export const clearLoginAttempts = () => loginLimiter.reset(LOGIN_ATTEMPT_KEY);

export const formatRateLimitRetry = (retryAfterMs: number) => {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes ? `${minutes} min ${remainingSeconds} s` : `${remainingSeconds} s`;
};

export const loginRateLimitMessage = (retryAfterMs: number) =>
  `Has intentado iniciar sesión demasiadas veces desde este navegador. Espera ${formatRateLimitRetry(retryAfterMs)} antes de volver a intentarlo.`;
