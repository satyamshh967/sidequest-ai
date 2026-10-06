import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enableOfflineIsolation,
  disableOfflineIsolation,
  OfflineViolationError,
} from '../src/utils/offline_guard.js';

describe('Offline Network Isolation Test', () => {
  beforeEach(() => {
    enableOfflineIsolation();
  });

  afterEach(() => {
    disableOfflineIsolation();
  });

  it('permits localhost network calls for local inference and server', async () => {
    // Calling localhost endpoint should NOT throw OfflineViolationError
    try {
      await fetch('http://127.0.0.1:11434/api/version');
    } catch (err: any) {
      // It may fail with ECONNREFUSED if Ollama is busy, but must NOT throw OfflineViolationError
      expect(err).not.toBeInstanceOf(OfflineViolationError);
    }
  });

  it('fails immediately when an outbound request leaves localhost (e.g. cloud API)', async () => {
    await expect(async () => {
      await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o' }),
      });
    }).rejects.toThrow(OfflineViolationError);
  });

  it('fails when an outbound request attempts to query external telemetry or analytics', async () => {
    await expect(async () => {
      await fetch('https://telemetry.example.org/v1/track');
    }).rejects.toThrow(OfflineViolationError);
  });
});
