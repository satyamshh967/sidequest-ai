import http from 'node:http';
import https from 'node:https';

export class OfflineViolationError extends Error {
  constructor(public destination: string) {
    super(`[OFFLINE VIOLATION] Outbound network request attempted to '${destination}'. Sidequest core loop must operate strictly on localhost.`);
    this.name = 'OfflineViolationError';
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function isLocalhost(host: string | undefined): boolean {
  if (!host) return true;
  const cleanHost = host.split(':')[0].toLowerCase();
  if (LOCAL_HOSTS.has(cleanHost)) return true;
  // Local private hotspot subnets are permissible for client-phone to laptop communication:
  // 192.168.x.x, 10.x.x.x, 172.16-31.x.x
  if (
    cleanHost.startsWith('192.168.') ||
    cleanHost.startsWith('10.') ||
    cleanHost.startsWith('172.') ||
    cleanHost.endsWith('.local')
  ) {
    return true;
  }
  return false;
}

let isEnforced = false;
let originalHttpRequest: typeof http.request | null = null;
let originalHttpsRequest: typeof https.request | null = null;
let originalFetch: typeof globalThis.fetch | null = null;

/**
 * Enforces strict offline isolation.
 * Any network attempt directed outside localhost or local private network throws OfflineViolationError.
 */
export function enableOfflineIsolation(): void {
  if (isEnforced) return;
  isEnforced = true;

  originalHttpRequest = http.request;
  originalHttpsRequest = https.request;
  originalFetch = globalThis.fetch;

  // Intercept http.request
  // @ts-expect-error Intercepting native http.request for isolation assertion
  http.request = function (options: any, callback?: any) {
    const targetHost =
      typeof options === 'string'
        ? new URL(options).hostname
        : options?.hostname || options?.host;

    if (!isLocalhost(targetHost)) {
      throw new OfflineViolationError(targetHost ?? 'unknown');
    }
    return originalHttpRequest!.apply(http, [options, callback]);
  };

  // Intercept https.request
  // @ts-expect-error Intercepting native https.request for isolation assertion
  https.request = function (options: any, callback?: any) {
    const targetHost =
      typeof options === 'string'
        ? new URL(options).hostname
        : options?.hostname || options?.host;

    if (!isLocalhost(targetHost)) {
      throw new OfflineViolationError(targetHost ?? 'unknown');
    }
    return originalHttpsRequest!.apply(https, [options, callback]);
  };

  // Intercept globalThis.fetch
  globalThis.fetch = async function (input: any, init?: any) {
    let targetHost: string | undefined;
    if (typeof input === 'string') {
      try {
        targetHost = new URL(input).hostname;
      } catch {
        // relative or custom url
      }
    } else if (input instanceof URL) {
      targetHost = input.hostname;
    } else if (input && typeof input.url === 'string') {
      try {
        targetHost = new URL(input.url).hostname;
      } catch {
        // relative
      }
    }

    if (targetHost && !isLocalhost(targetHost)) {
      throw new OfflineViolationError(targetHost);
    }

    return originalFetch!.apply(globalThis, [input, init]);
  };
}

/**
 * Disables strict offline isolation (restoring original handlers).
 */
export function disableOfflineIsolation(): void {
  if (!isEnforced) return;
  if (originalHttpRequest) http.request = originalHttpRequest;
  if (originalHttpsRequest) https.request = originalHttpsRequest;
  if (originalFetch) globalThis.fetch = originalFetch;
  isEnforced = false;
}
