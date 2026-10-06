import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { initMastra } from '../mastra/index.js';
import { SidequestDatabase } from '../db/database.js';
import { enableOfflineIsolation } from '../utils/offline_guard.js';

// Enforce offline network isolation on server startup
enableOfflineIsolation();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const uploadsDir = path.resolve('./data/uploads');
const journalsDir = path.resolve('./data/journals');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(journalsDir)) fs.mkdirSync(journalsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));
app.use('/journals', express.static(journalsDir));
app.use(express.static(path.resolve('./public')));

// Configure Multer for local photo uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `find-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
  },
});
const upload = multer({ storage });

const db = new SidequestDatabase();
const { tools, ollama } = initMastra();

// Initialize database
await db.init();

// --- API Endpoints ---

// Health & System status
app.get('/api/status', async (_req: Request, res: Response) => {
  const isOllamaUp = await ollama.isAvailable();
  const models = await ollama.listModels();
  res.json({
    status: 'ok',
    offlineOnly: true,
    ollamaConnected: isOllamaUp,
    models,
  });
});

// 1. Generate Quest
app.post('/api/quest/generate', async (req: Request, res: Response) => {
  try {
    const result: any = await tools.generateQuestTool.execute(req.body);
    if (result && result.error) {
      throw new Error(result.message || 'Quest generation failed validation');
    }
    const questPlan = result;

    const sessionId = randomUUID();
    db.saveSession({
      id: sessionId,
      questTitle: questPlan.questTitle || 'Outdoor Nature Quest',
      setting: questPlan.setting || req.body.setting || 'park',
      ageBand: req.body.ageBand || 'young_kids',
      seasonAndRegion: req.body.seasonAndRegion || 'Local Walk',
      startTime: new Date().toISOString(),
      questPlanJson: JSON.stringify(questPlan),
    });

    res.json({
      sessionId,
      quest: questPlan,
    });
  } catch (err: any) {
    console.error('Quest generation failed:', err);
    res.status(500).json({ error: err.message || 'Failed to generate quest' });
  }
});

// 2. Verify Find (with photo upload)
app.post(
  '/api/quest/verify',
  upload.single('photo'),
  async (req: Request, res: Response) => {
    try {
      const {
        sessionId,
        questItemId,
        itemTitle,
        category,
        targetDescription,
        verificationGuidance,
      } = req.body;

      let imageBase64: string | undefined;
      let photoFilename: string | undefined;

      if (req.file) {
        photoFilename = req.file.filename;
        const fileBuffer = fs.readFileSync(req.file.path);
        imageBase64 = fileBuffer.toString('base64');
      } else if (req.body.imageBase64) {
        imageBase64 = req.body.imageBase64;
        photoFilename = `find-${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;
        fs.writeFileSync(
          path.join(uploadsDir, photoFilename),
          Buffer.from(imageBase64, 'base64')
        );
      }

      const verifyRes: any = await tools.verifyFindTool.execute({
        questItemId: questItemId || 'unknown',
        itemTitle: itemTitle || 'Unknown item',
        targetDescription: targetDescription || '',
        verificationGuidance: verificationGuidance || '',
        imageBase64,
      });

      if (verifyRes && verifyRes.error) {
        throw new Error(verifyRes.message || 'Find verification validation failed');
      }
      const verification = verifyRes;

      const findId = randomUUID();
      db.saveFind({
        id: findId,
        sessionId,
        questItemId,
        itemTitle,
        category: category || 'look',
        timestamp: new Date().toISOString(),
        found: verification.found,
        confidence: verification.confidence,
        isUncertain: verification.isUncertain,
        speciesIdentified: verification.speciesIdentified,
        certaintyCaveat: verification.certaintyCaveat,
        spokenFeedback: verification.spokenFeedback,
        followUpQuestion: verification.followUpQuestion,
        observationNotes: verification.observationNotes,
        photoFilename,
      });

      res.json({
        findId,
        verification,
        photoUrl: photoFilename ? `/uploads/${photoFilename}` : null,
      });
    } catch (err: any) {
      console.error('Find verification error:', err);
      res.status(500).json({ error: err.message || 'Verification failed' });
    }
  }
);

// 3. Update Session Metrics (Screen-to-Sky tracking)
app.post('/api/session/metrics', (req: Request, res: Response) => {
  try {
    const { sessionId, endTime, durationSeconds, screenActiveSeconds } = req.body;
    db.updateSessionMetrics(sessionId, endTime, durationSeconds, screenActiveSeconds);
    res.json({ status: 'updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Complete Session & Export Journal
app.post('/api/session/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId, durationSeconds, screenActiveSeconds, reflectionNotes } =
      req.body;

    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const finds = db.getSessionFinds(sessionId);
    const plan = JSON.parse(session.quest_plan_json);

    const screenToSkyRatio =
      durationSeconds > 0
        ? Math.min(1.0, Number((screenActiveSeconds / durationSeconds).toFixed(4)))
        : 0;

    const journalData = {
      sessionId,
      questTitle: session.quest_title,
      themeNarrative: plan.themeNarrative || '',
      setting: session.setting,
      seasonAndRegion: session.season_and_region,
      startTime: session.start_time,
      endTime: new Date().toISOString(),
      totalDurationSeconds: durationSeconds || 1,
      screenActiveSeconds: screenActiveSeconds || 0,
      screenToSkyRatio,
      itemsFound: finds
        .filter((f) => f.found === 1)
        .map((f) => ({
          itemId: f.quest_item_id,
          itemTitle: f.item_title,
          category: f.category,
          timestamp: f.timestamp,
          photoFilename: f.photo_filename,
          speciesHint: f.species_identified,
          observationNotes: f.observation_notes,
          kidFriendlyQuote: f.spoken_feedback,
        })),
      totalItemsCount: plan.items.length,
      reflectionSummary:
        reflectionNotes ||
        `Explored ${session.setting} during ${session.season_and_region}. Spent ${(
          (1 - screenToSkyRatio) *
          100
        ).toFixed(1)}% of the walk with eyes on nature!`,
    };

    const journalExport = await tools.saveJournalTool.execute(journalData);

    res.json({
      journalUrl: `/journals/journal-${sessionId}.html`,
      journalExport,
    });
  } catch (err: any) {
    console.error('Session complete error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[Sidequest Server] Running on http://0.0.0.0:${port} (Offline Only)`);
});
