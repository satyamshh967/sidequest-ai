import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { WalkJournalSchema, WalkJournal } from '../../schemas/journal.js';

export function createSaveJournalTool(outputDir = './data/journals') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return createTool({
    id: 'save_journal',
    description: 'Generates and exports an offline self-contained HTML Field Journal for the completed walk.',
    inputSchema: WalkJournalSchema,
    outputSchema: z.object({
      journalPath: z.string(),
      screenToSkyRatio: z.number(),
      itemsRecorded: z.number(),
    }),
    execute: async (input: any) => {
      const journal: WalkJournal = input.context ?? input;

      const screenPct = (journal.screenToSkyRatio * 100).toFixed(1);
      const skyPct = (100 - journal.screenToSkyRatio * 100).toFixed(1);

      const itemsHtml = journal.itemsFound
        .map(
          (item) => `
        <div class="journal-card">
          <div class="card-header">
            <span class="badge ${item.category}">${item.category.toUpperCase()}</span>
            <h3>${item.itemTitle}</h3>
            <span class="timestamp">${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          ${
            item.photoFilename
              ? `<div class="card-img-wrapper"><img src="/uploads/${item.photoFilename}" alt="${item.itemTitle}" /></div>`
              : ''
          }
          <div class="card-body">
            <p class="notes">${item.observationNotes}</p>
            ${
              item.speciesHint
                ? `<p class="species"><strong>Species observation:</strong> ${item.speciesHint} <em>(AI estimated; observe cautiously)</em></p>`
                : ''
            }
            <blockquote class="quote">"${item.kidFriendlyQuote}"</blockquote>
          </div>
        </div>
      `
        )
        .join('');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sidequest Field Journal — ${journal.questTitle}</title>
  <style>
    :root {
      --bg: #0f1715;
      --card-bg: #182521;
      --accent: #22c55e;
      --text: #f0fdf4;
      --text-muted: #86efac;
      --border: #234338;
      --sky-color: #38bdf8;
      --screen-color: #f97316;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 1.5rem;
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    h1 { font-size: 2rem; color: var(--accent); margin-bottom: 0.25rem; }
    .subtitle { color: #cbd5e1; font-size: 1.1rem; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-top: 1.25rem;
      background: var(--card-bg);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .meta-item strong { display: block; font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; }
    .meta-item span { font-size: 1.1rem; font-weight: 600; }
    
    /* Screen to Sky Metric */
    .metric-container {
      margin: 2rem 0;
      background: var(--card-bg);
      padding: 1.25rem;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .metric-title { font-weight: 700; margin-bottom: 0.5rem; display: flex; justify-content: space-between; }
    .ratio-bar {
      height: 24px;
      width: 100%;
      background: var(--screen-color);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
    }
    .sky-portion { background: var(--sky-color); height: 100%; transition: width 0.3s; }
    .ratio-legend {
      display: flex;
      justify-content: space-between;
      margin-top: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .legend-sky { color: var(--sky-color); }
    .legend-screen { color: var(--screen-color); }

    /* Finds */
    .journal-grid { display: flex; flex-direction: column; gap: 1.5rem; }
    .journal-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .card-header {
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .card-header h3 { flex-grow: 1; font-size: 1.2rem; }
    .badge {
      font-size: 0.7rem;
      font-weight: 800;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: #334155;
      color: #f8fafc;
    }
    .badge.look { background: #0284c7; }
    .badge.listen { background: #7c3aed; }
    .badge.touch_safe { background: #059669; }
    .badge.count { background: #d97706; }
    .badge.compare { background: #db2777; }
    .card-img-wrapper img {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      display: block;
    }
    .card-body { padding: 1rem; }
    .notes { margin-bottom: 0.75rem; font-size: 1rem; }
    .species {
      font-size: 0.9rem;
      background: #111e19;
      padding: 0.5rem;
      border-left: 3px solid var(--accent);
      margin-bottom: 0.75rem;
    }
    .quote {
      font-style: italic;
      color: var(--text-muted);
      border-left: 2px solid #64748b;
      padding-left: 0.75rem;
    }
    footer {
      margin-top: 3rem;
      text-align: center;
      font-size: 0.85rem;
      color: #64748b;
      border-top: 1px solid var(--border);
      padding-top: 1.5rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>🌿 Sidequest Field Journal</h1>
    <div class="subtitle">${journal.questTitle}</div>
    <div class="meta-grid">
      <div class="meta-item"><strong>Setting</strong><span>${journal.setting}</span></div>
      <div class="meta-item"><strong>Region / Season</strong><span>${journal.seasonAndRegion}</span></div>
      <div class="meta-item"><strong>Walk Duration</strong><span>${Math.round(journal.totalDurationSeconds / 60)} mins</span></div>
      <div class="meta-item"><strong>Items Found</strong><span>${journal.itemsFound.length} of ${journal.totalItemsCount}</span></div>
    </div>
  </header>

  <section class="metric-container">
    <div class="metric-title">
      <span>Screen-to-Sky Ratio</span>
      <span>${skyPct}% Eyes on Nature</span>
    </div>
    <div class="ratio-bar">
      <div class="sky-portion" style="width: ${skyPct}%;"></div>
    </div>
    <div class="ratio-legend">
      <span class="legend-sky">⛅ Eyes on Sky / Path (${Math.round((journal.totalDurationSeconds - journal.screenActiveSeconds) / 60)} min)</span>
      <span class="legend-screen">📱 Screen Active (${Math.round(journal.screenActiveSeconds)} sec)</span>
    </div>
  </section>

  <section class="journal-grid">
    ${itemsHtml}
  </section>

  <footer>
    <p>Generated completely offline by <strong>Sidequest</strong> with local open-weight multimodal Gemma & Mastra.</p>
    <p>Walked on ${new Date(journal.startTime).toLocaleDateString()} • Hacktoberfest 2026: Touch Grass</p>
  </footer>
</body>
</html>`;

      const filename = `journal-${journal.sessionId}.html`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, html, 'utf-8');

      return {
        journalPath: filePath,
        screenToSkyRatio: journal.screenToSkyRatio,
        itemsRecorded: journal.itemsFound.length,
      };
    },
  });
}
