import { describe, expect, it } from 'vitest';
import { BrowserRateLimiter, formatRateLimitRetry } from './clientRateLimit';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('BrowserRateLimiter', () => {
  it('permite el número configurado de intentos y bloquea el siguiente con espera exacta', () => {
    let now = 1_000;
    const limiter = new BrowserRateLimiter(new MemoryStorage(), () => now);
    const policy = { maxAttempts: 2, windowMs: 10_000 };

    expect(limiter.claim('login', policy)).toEqual({ allowed: true });
    now += 500;
    expect(limiter.claim('login', policy)).toEqual({ allowed: true });
    now += 500;
    expect(limiter.claim('login', policy)).toEqual({ allowed: false, retryAfterMs: 9_000 });
  });

  it('descarta marcas inválidas o expiradas sin bloquear nuevos intentos', () => {
    let now = 20_000;
    const storage = new MemoryStorage();
    storage.setItem('login', JSON.stringify([NaN, 'malformed', 1_000]));
    const limiter = new BrowserRateLimiter(storage, () => now);

    expect(limiter.claim('login', { maxAttempts: 1, windowMs: 5_000 })).toEqual({ allowed: true });
  });

  it('formatea la espera sin exponer cuentas ni credenciales', () => {
    expect(formatRateLimitRetry(61_000)).toBe('1 min 1 s');
    expect(formatRateLimitRetry(8_200)).toBe('9 s');
  });

  it('limpia únicamente el contador de esta sesión tras un acceso correcto', () => {
    let now = 1_000;
    const limiter = new BrowserRateLimiter(new MemoryStorage(), () => now);
    const policy = { maxAttempts: 1, windowMs: 10_000 };

    expect(limiter.claim('login', policy)).toEqual({ allowed: true });
    expect(limiter.claim('login', policy)).toMatchObject({ allowed: false });
    limiter.reset('login');
    now += 1;
    expect(limiter.claim('login', policy)).toEqual({ allowed: true });
  });
});
