import initSqlJs, { Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

export interface SessionRecord {
  id: string;
  questTitle: string;
  setting: string;
  ageBand: string;
  seasonAndRegion: string;
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
  screenActiveSeconds?: number;
  screenToSkyRatio?: number;
  questPlanJson: string;
}

export interface FindRecord {
  id: string;
  sessionId: string;
  questItemId: string;
  itemTitle: string;
  category: string;
  timestamp: string;
  found: boolean;
  confidence: number;
  isUncertain: boolean;
  speciesIdentified: string | null;
  certaintyCaveat: string | null;
  spokenFeedback: string;
  followUpQuestion: string | null;
  observationNotes: string;
  photoFilename?: string;
}

export class SidequestDatabase {
  private db: Database | null = null;
  private dbFilePath: string;

  constructor(storageDir = './data') {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.dbFilePath = path.join(storageDir, 'sidequest.sqlite');
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
      this.createTables();
      this.persist();
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        quest_title TEXT NOT NULL,
        setting TEXT NOT NULL,
        age_band TEXT NOT NULL,
        season_and_region TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_seconds REAL DEFAULT 0,
        screen_active_seconds REAL DEFAULT 0,
        screen_to_sky_ratio REAL DEFAULT 0,
        quest_plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS finds (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        quest_item_id TEXT NOT NULL,
        item_title TEXT NOT NULL,
        category TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        found INTEGER NOT NULL,
        confidence REAL NOT NULL,
        is_uncertain INTEGER NOT NULL,
        species_identified TEXT,
        certainty_caveat TEXT,
        spoken_feedback TEXT NOT NULL,
        follow_up_question TEXT,
        observation_notes TEXT NOT NULL,
        photo_filename TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );
    `);
  }

  persist(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbFilePath, buffer);
  }

  saveSession(record: SessionRecord): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(
      `INSERT OR REPLACE INTO sessions (
        id, quest_title, setting, age_band, season_and_region,
        start_time, end_time, duration_seconds, screen_active_seconds,
        screen_to_sky_ratio, quest_plan_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.questTitle,
        record.setting,
        record.ageBand,
        record.seasonAndRegion,
        record.startTime,
        record.endTime ?? null,
        record.durationSeconds ?? 0,
        record.screenActiveSeconds ?? 0,
        record.screenToSkyRatio ?? 0,
        record.questPlanJson,
        new Date().toISOString(),
      ]
    );
    this.persist();
  }

  updateSessionMetrics(
    sessionId: string,
    endTime: string,
    durationSeconds: number,
    screenActiveSeconds: number
  ): void {
    if (!this.db) throw new Error('Database not initialized');
    const screenToSkyRatio =
      durationSeconds > 0
        ? Math.min(1.0, Number((screenActiveSeconds / durationSeconds).toFixed(4)))
        : 0;

    this.db.run(
      `UPDATE sessions 
       SET end_time = ?, duration_seconds = ?, screen_active_seconds = ?, screen_to_sky_ratio = ? 
       WHERE id = ?`,
      [endTime, durationSeconds, screenActiveSeconds, screenToSkyRatio, sessionId]
    );
    this.persist();
  }

  saveFind(find: FindRecord): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(
      `INSERT OR REPLACE INTO finds (
        id, session_id, quest_item_id, item_title, category,
        timestamp, found, confidence, is_uncertain,
        species_identified, certainty_caveat, spoken_feedback,
        follow_up_question, observation_notes, photo_filename
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        find.id,
        find.sessionId,
        find.questItemId,
        find.itemTitle,
        find.category,
        find.timestamp,
        find.found ? 1 : 0,
        find.confidence,
        find.isUncertain ? 1 : 0,
        find.speciesIdentified,
        find.certaintyCaveat,
        find.spokenFeedback,
        find.followUpQuestion,
        find.observationNotes,
        find.photoFilename ?? null,
      ]
    );
    this.persist();
  }

  getSession(id: string): any {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  getSessionFinds(sessionId: string): any[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(
      'SELECT * FROM finds WHERE session_id = ? ORDER BY timestamp ASC'
    );
    stmt.bind([sessionId]);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}
