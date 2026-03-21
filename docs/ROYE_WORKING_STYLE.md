# ROYE — Working Style & Collaboration Guide
**Version:** 1.0 | **Date:** 2026-03-21 | **Time:** 10:55 IST
**שים קובץ זה ב:** `docs/ROYE_WORKING_STYLE.md` בכל פרויקט

---

## מי אנחנו — The Triangle

```
┌─────────────────────────────────────────────────────┐
│  ROYE (Human — Decision Maker)                       │
│  דובר עברית, מקבל החלטות מהיר, חושב ויזואלית        │
│  מתקשר דרך: טקסט, screenshots, voice notes          │
└──────────────────────┬──────────────────────────────┘
                       │ עברית
                       ▼
┌─────────────────────────────────────────────────────┐
│  STRATEGIC AI (Claude.ai — Planner)                  │
│  מנתח, מתכנן, כותב VAMOS prompts באנגלית            │
│  מייצר: קבצי .md עם הנחיות מובנות                   │
└──────────────────────┬──────────────────────────────┘
                       │ English .md file
                       ▼
┌─────────────────────────────────────────────────────┐
│  CLAUDE BOT (Claude Code — Executor)                 │
│  קורא קבצים, מבצע אוטומטית, מדווח תוצאות           │
│  מייצר: קוד, deployments, git commits               │
└─────────────────────────────────────────────────────┘
```

---

## חוקי זהב — לא ניתן לשבירה

### 1. קבצים תמיד — לא פקודות בצ'אט
```
✅ צור קובץ .md ושלח לבוט
❌ "נסה להריץ את הפקודה הזאת..."
```
Roye ביקש קבצים 300 פעם. תמיד קובץ.

### 2. שם קובץ = תאריך + שעה IST
```
✅ PROJ-TASK-2026-03-21-1055.md
❌ sprint-prompt.md
```
פורמט: `PROJ-TASK-YYYY-MM-DD-HHMM.md` — שעון ישראל, 24 שעות, ללא נקודתיים.

### 3. אם לא הבנת — תשאל
```
✅ שאלה אחת קצרה
❌ לנחש ולממש משהו שגוי
```
שאלה אחת > טעות שמבזבזת שעה.

### 4. אוטו-אישור — בצע ללא שאלה
קלוד בוט מאשר לעצמו:
- TypeScript checks
- npm run build
- git add, commit, push
- npx vercel --prod --yes
- railway up --detach
- קריאת קבצים, יצירת קבצים, תיקון bugs ברורים

קלוד בוט **חייב לשאול** לפני:
- Push to TestFlight
- שינוי ארכיטקטורלי גדול
- DROP TABLE / DELETE עם נתונים אמיתיים
- כל דבר שלא ניתן לבטל

**הכלל:** ניתן לבטל → עשה. לא ניתן לבטל → שאל.

---

## שפה

| הקשר | שפה |
|------|-----|
| Roye → Strategic AI | עברית |
| Strategic AI → Roye | עברית |
| VAMOS prompts לבוט | אנגלית |
| קוד + comments | אנגלית |
| Git commits | אנגלית |
| שמות קבצים | אנגלית + timestamp IST |

---

## מה Roye אוהב

| עשה | אל תעשה |
|-----|---------|
| טבלאות וסיכומים | פסקאות ארוכות |
| פעל מיד | בקש אישור על דברים ברורים |
| מצא bugs שRoye לא ציין | התעלם משגיאות ב-console |
| החלט — אל תציע 2 אפשרויות | "אפשרות A או B?" |
| קוד מחובר end-to-end | mock data / TODO / placeholder |
| iteration מהיר | planning sessions ארוכים |
| numbered findings עם עדיפויות | "things to improve" מעורפל |

---

## VAMOS Format — מה שעובד (מוכח על 3,203 sessions)

```markdown
# VAMOS MEGA PROMPT — [שם המשימה]
**Date:** YYYY-MM-DD-HHMM IST

Yes, allow all edits in components

## FIRST ACTIONS
Read MEMORY.md
Read IRON_RULES.md
Create session file: docs/sessions/SESSION-YYYY-MM-DD-HHMM.md
cd [project_path]

## CONTEXT
[מה קרה, מה נשבר, evidence]

## AGENT 1 — [שם]
[משימה ממוספרת]

## AGENT 2 — [שם]
[משימה ממוספרת]

## AGENT N — Deploy
tsc --noEmit → build → git push → deploy → verify

## SUCCESS CRITERIA
- [ ] TypeScript: 0 errors
- [ ] Build: clean
- [ ] [specific criteria]

## ON COMPLETION
Update MEMORY.md → write session log → push

## MANUAL_TASKS
(ריק — הבוט עושה הכל. אם יש כאן משהו = כשל בתכנון)
```

**למה זה עובד:** Q=10 sessions = 4-6 turns, 0 errors, working dir + file paths + numbered steps.

---

## Anti-Guessing Rules — אפס ניחושים

```
NEVER: mock data, static/placeholder, TODO comments
NEVER: invent table names — use only tables that exist
NEVER: recreate components that already exist — import them
NEVER: use Stripe — Israeli merchant = Payplus only
NEVER: prisma db push if unknown tables exist in DB
ALWAYS: ALTER TABLE — never DROP/TRUNCATE with real data
ALWAYS: tsc --noEmit before commit (0 errors required)
ALWAYS: end session with MEMORY.md update + session log
```

---

## Infrastructure Standards

### Payments
Israeli merchant → **Payplus** (not Stripe, not LemonSqueezy)
```typescript
// shared-utils/src/payplus.ts
import { createPayplusPayment } from '@royea/shared-utils/payplus'
```

### Database
Supabase always. Never expose service_role key in client.
```typescript
// Always ALTER TABLE — never DROP
// Always check row count before migration
// Always enable RLS on all tables
```

### Deploy
- Next.js → `npx vercel --prod --yes`
- Node/NestJS → `railway up --detach`
- iOS → EAS (never manual Xcode, never touch p12)
- Android → EAS or GitHub Actions

### Mobile
- Capacitor: PlistBuddy updates version, GitHub Actions CI
- Expo/EAS: submit profile = `preview` (NEVER `ci`)
- TestFlight: only with explicit "אשר" from Roye

---

## Session Protocol — כל session

### פתיחה:
```bash
cat MEMORY.md
cat IRON_RULES.md
TIMESTAMP=$(date +%H-%M)
mkdir -p docs/sessions docs/prompts
echo "# Session $(date '+%Y-%m-%d %H:%M')" > docs/sessions/SESSION-$(date +%Y-%m-%d)-${TIMESTAMP}.md
```

### סגירה:
```bash
# Update MEMORY.md with today's work
# Append to session log
git add -A
git commit -m "chore: session close $(date +%Y-%m-%d)"
git push
```

---

## Context Classification — חדש

כדי שמערכת הלמידה תבין את שלושת הצדדים:

**הודעות Roye מסווגות ל-2 סוגים:**
- 🧠 `[ROYE]` — מחשבה מהראש, החלטה, שאלה, כיוון
- 📋 `[BOT_OUTPUT]` — copy-paste מקלוד בוט

**דוגמאות:**
```
[ROYE] "אני רוצה שהדשבורד יראה את כל הפרויקטים לפי workspace"
→ זה כוונה מקורית — מה Roye חושב

[BOT_OUTPUT] "Sprint 12 done. TypeScript: clean | Build: clean | Pushed: bcf8833"
→ זה תוצאת ביצוע — מה קלוד בוט עשה
```

**איך זה עוזר:**
- 11STEPS2DONE לומד מה Roye מבקש בפועל (סגנון, רמת פירוט)
- Strategic AI לומד אילו בקשות גורמות לQ גבוה
- קלוד בוט לומד מה הפורמט שמביא לRoye ל-"כן" מהיר

---

## Shared Utils Library

```typescript
// C:/Projects/shared-utils/src/
// Use across all projects:
import { BugReporter } from '@royea/shared-utils/bug-reporter'
import { createPayplusPayment } from '@royea/shared-utils/payplus'
import { FeedbackWidget } from '@royea/shared-utils/feedback-widget'
import { rateLimit } from '@royea/shared-utils/rate-limiter'
import { generateMemoryMd } from '@royea/shared-utils/memory-generator'
```

---

## ZProjectManager Integration

כל פרויקט רשום ב-ZProjectManager:
- `C:/Projects/ZProjectManager` — desktop app
- Portfolio Dashboard → workspace filter (mine / client / partnership)
- Intelligence Engine → מציג מה דחוף
- GPROMPT Generator → מייצר prompts מבוססי DB
- Pipeline → 11STEPS2DONE integration, 3,203 sessions, Q score

**כדי לייצר GPROMPT לפרויקט זה:**
פתח ZProjectManager → Projects → [project name] → Prompt tab → בחר action → Generate

---

## Quality Score Reference (Q Score)

```
Q=10: ≤6 turns, 0 errors — perfect prompt
Q=8-9: short, clean, minor clarifications
Q=5-7: average — some back-and-forth
Q=2-4: long, many errors, unclear prompt
```

**המטרה:** כל VAMOS prompt = Q≥8

---
*נוצר על ידי ZProjectManager | מעודכן: 2026-03-21 IST*
