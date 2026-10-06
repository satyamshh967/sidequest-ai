import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SidequestDatabase } from '../src/db/database.js';
import { createSaveJournalTool } from '../src/mastra/tools/save_journal_tool.js';
import { enableOfflineIsolation, disableOfflineIsolation } from '../src/utils/offline_guard.js';

describe('End-to-End Core Offline Walk Engine', () => {
  const testDataDir = './data/test_e2e';
  let db: SidequestDatabase;

  beforeAll(async () => {
    enableOfflineIsolation();
    if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
    db = new SidequestDatabase(testDataDir);
    await db.init();
  });

  afterAll(() => {
    disableOfflineIsolation();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('persists walk session and calculates accurate screen-to-sky ratio', () => {
    const sessionId = 'test-session-123';
    db.saveSession({
      id: sessionId,
      questTitle: 'Autumn Forest Scavenger Hunt',
      setting: 'trail',
      ageBand: 'young_kids',
      seasonAndRegion: 'Autumn / Cascades',
      startTime: new Date(Date.now() - 1800 * 1000).toISOString(),
      questPlanJson: JSON.stringify({
        questTitle: 'Autumn Forest Scavenger Hunt',
        themeNarrative: 'A sensory walk in the woods.',
        items: [
          {
            id: 'item-1',
            title: 'Fallen Maple Leaf',
            category: 'look',
            promptText: 'Find a golden maple leaf.',
            targetDescription: 'Yellow maple leaf',
            verificationGuidance: 'Yellow maple leaf',
            points: 50,
          },
        ],
      }),
    });

    // 1800 total seconds (30 mins), 72 seconds screen-on time (4% screen, 96% sky!)
    const totalDurationSeconds = 1800;
    const screenActiveSeconds = 72;
    const endTime = new Date().toISOString();

    db.updateSessionMetrics(sessionId, endTime, totalDurationSeconds, screenActiveSeconds);

    const session = db.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session.id).toBe(sessionId);
    expect(session.duration_seconds).toBe(1800);
    expect(session.screen_active_seconds).toBe(72);
    expect(session.screen_to_sky_ratio).toBe(0.04);
  });

  it('records verified finds with honesty flags in database', () => {
    const sessionId = 'test-session-123';
    db.saveFind({
      id: 'find-001',
      sessionId,
      questItemId: 'item-1',
      itemTitle: 'Fallen Maple Leaf',
      category: 'look',
      timestamp: new Date().toISOString(),
      found: true,
      confidence: 0.94,
      isUncertain: false,
      speciesIdentified: 'Bigleaf Maple (Acer macrophyllum)',
      certaintyCaveat: 'Species ID is an algorithmic estimate; treat with care.',
      spokenFeedback: 'Wonderful eye! You found a bright golden maple leaf.',
      followUpQuestion: null,
      observationNotes: 'Five-lobed golden leaf resting on dark trail moss.',
    });

    const finds = db.getSessionFinds(sessionId);
    expect(finds).toHaveLength(1);
    expect(finds[0].found).toBe(1);
    expect(finds[0].species_identified).toContain('Bigleaf Maple');
    expect(finds[0].certainty_caveat).toBeDefined();
  });

  it('exports standalone HTML field journal with screen-to-sky ratio bar', async () => {
    const journalTool = createSaveJournalTool(path.join(testDataDir, 'journals'));

    const result: any = await journalTool.execute({
      sessionId: 'test-session-123',
      questTitle: 'Autumn Forest Scavenger Hunt',
      themeNarrative: 'A sensory walk in the woods.',
      setting: 'trail',
      seasonAndRegion: 'Autumn / Cascades',
      startTime: new Date(Date.now() - 1800 * 1000).toISOString(),
      endTime: new Date().toISOString(),
      totalDurationSeconds: 1800,
      screenActiveSeconds: 72,
      screenToSkyRatio: 0.04,
      itemsFound: [
        {
          itemId: 'item-1',
          itemTitle: 'Fallen Maple Leaf',
          category: 'look',
          timestamp: new Date().toISOString(),
          speciesHint: 'Bigleaf Maple',
          observationNotes: 'Golden leaf resting on moss.',
          kidFriendlyQuote: 'Wonderful eye! You found a bright golden maple leaf.',
        },
      ],
      totalItemsCount: 5,
      reflectionSummary: 'Spent 96% of the walk looking up at trees and sky!',
    });

    expect(result.itemsRecorded).toBe(1);
    expect(result.screenToSkyRatio).toBe(0.04);
    expect(fs.existsSync(result.journalPath)).toBe(true);

    const htmlContent = fs.readFileSync(result.journalPath, 'utf-8');
    expect(htmlContent).toContain('Sidequest Field Journal');
    expect(htmlContent).toContain('Screen-to-Sky Ratio');
    expect(htmlContent).toContain('96.0% Eyes on Nature');
    expect(htmlContent).toContain('Fallen Maple Leaf');
  });
});
