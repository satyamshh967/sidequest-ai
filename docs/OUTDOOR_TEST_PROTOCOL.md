# Sidequest Outdoor Field Test Protocol & Checklist

This protocol governs the 3 real-world field trials required for the DEV **Touch Grass** challenge submission. Each outing must be executed completely offline (zero internet) using the backpack laptop host + iPhone Safari PWA setup.

---

## Pre-Walk Departure Checklist

Before stepping outside:
- [ ] **Laptop Battery:** Charged to $\ge 90\%$. Battery saver set to "Balanced" so GPU tensor cores stay active.
- [ ] **Vents:** Laptop placed vertically in backpack with exhaust vents unobstructed.
- [ ] **Local Daemon Active:** Ollama running on `http://127.0.0.1:11434` with `gemma3:4b`.
- [ ] **Sidequest Server Active:** `npm start` running on port 3000.
- [ ] **Hotspot Active:** Windows Mobile Hotspot turned ON (Internet sharing OFF; local LAN only).
- [ ] **Phone Connected:** iPhone connected to backpack Wi-Fi SSID.
- [ ] **PWA Loaded:** Safari opened to `http://192.168.137.1:3000`, verified offline status badge.
- [ ] **Audio Test:** Tap "Hear Prompt" once to test iPhone offline speech synthesis volume.
- [ ] **Pocket Mode Ready:** Pocket Dim verified. Phone goes into pocket/hand without needing to look at screen.

---

## Field Test Outing Profiles

### Outing 1: Neighborhood / Suburban Street Walk
- **Target Setting:** Residential sidewalks, street trees, garden edges, driveway stones.
- **Recommended Age Band:** Kids (4–8) or Solo exploration.
- **Duration Goal:** 15–20 minutes.
- **Focus:** Quick tactile bark prompts, counting fallen leaves, sidewalk lichen.

### Outing 2: City Park Walk
- **Target Setting:** Municipal park with grassy fields, mixed tree stands, park benches, and bird activity.
- **Recommended Age Band:** Kids (9–13) or Curious Adults.
- **Duration Goal:** 25–35 minutes.
- **Focus:** Canopy color variations, audio bird listening challenges, acorn cap search.

### Outing 3: Wooded Forest Trail
- **Target Setting:** Unpaved dirt trail through dense woods or nature preserve.
- **Recommended Age Band:** Curious Adults.
- **Duration Goal:** 30–45 minutes.
- **Focus:** Low-light shaded canopy, moss vs lichen differentiation, fallen wood textures, rock comparison.

---

## Field Outing Log Template

*(Duplicate this template for each of the 3 outings and record in `docs/field_logs/outing-X.md`)*

```markdown
# Field Outing #[1/2/3] Log

- **Date & Local Time:** YYYY-MM-DD HH:MM
- **Location & Setting:** [e.g., Maplewood Park, paved loop]
- **Weather / Sunlight:** [e.g., Overcast, dappled sunlight, bright noon]
- **Season & Region Typed:** [e.g., Autumn / Pacific Northwest]
- **Participants:** [Solo / Family]

### Quantitative Measurements
- **Total Walk Duration:** [e.g., 24 min 30 sec]
- **Screen-On Active Time:** [e.g., 58 seconds]
- **Screen-to-Sky Ratio:** [e.g., 96.1% Nature / 3.9% Screen]
- **Quest Items Attempted:** [e.g., 5 items]
- **Items Successfully Verified:** [e.g., 4 items]
- **Uncertain / Follow-Up Queries Triggered:** [e.g., 1 item]
- **False Positives / Erroneous Matches:** [e.g., 0]
- **Average Verification Latency:** [e.g., 1.4s per photo]
- **Host Laptop Battery Drain:** [e.g., 100% -> 89% (11% drain over 25m)]
- **iPhone Battery Drain:** [e.g., 94% -> 91% (3% drain)]

### Qualitative & Participant Observations
- **Direct Participant Quote 1:** "[Quote describing auditory or physical sensation, e.g., 'I haven't listened this closely to the wind in months.']"
- **Direct Participant Quote 2:** "[Quote regarding AI verification honesty or surprise]"

### Honest Failures & Model Behavior
- **Where did the model struggle?** [e.g., Partial shade on wet oak leaf caused initial hesitation until follow-up prompt asked for clearer lighting.]
- **Did the safety guardrails intervene?** [e.g., Model correctly warned against touching wild fungus.]
- **Physical ergonomics:** [e.g., Laptop heat in backpack, audio audibility in wind.]
```
