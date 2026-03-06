import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectStep {
  id: string;
  order: number;
  title: string;
  description: string;
  actionLabel: string;       // e.g. "Click here", "Type your Club ID"
  imagePath?: string;        // path to screenshot/mockup image
  mockupHtml?: string;       // generated visual mockup
  highlights: StepHighlight[];
  editable: boolean;
}

export interface StepHighlight {
  id: number;
  label: string;
  x: number;       // percent 0-100
  y: number;       // percent 0-100
  width: number;   // percent
  height: number;  // percent
  color: string;
}

export interface SmartProject {
  id: string;
  title: string;
  description: string;
  platform: string;
  language: 'he' | 'en';
  steps: ProjectStep[];
  clarifyingQuestions?: string[];
  ready: boolean;            // true = has enough info to generate
  createdAt: string;
}

export interface SmartInput {
  request: string;           // free text from user
  answers?: Record<string, string>;  // answers to clarifying questions
  language?: 'he' | 'en';
}

// ---------------------------------------------------------------------------
// Platform knowledge base
// ---------------------------------------------------------------------------

interface PlatformTemplate {
  names: string[];           // keywords to match
  platform: string;
  description: string;
  questions: Array<{ key: string; question_he: string; question_en: string; required: boolean }>;
  generateSteps: (answers: Record<string, string>, lang: 'he' | 'en') => ProjectStep[];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const PLATFORMS: PlatformTemplate[] = [
  {
    names: ['clubgg', 'club gg', 'gg poker', 'ggpoker club'],
    platform: 'ClubGG',
    description: 'ClubGG poker club platform',
    questions: [
      { key: 'clubId', question_he: 'מה ה-Club ID שלך?', question_en: 'What is your Club ID?', required: true },
      { key: 'clubName', question_he: 'מה שם המועדון?', question_en: 'What is your club name?', required: true },
      { key: 'agentId', question_he: 'יש לך Agent ID? (אופציונלי)', question_en: 'Do you have an Agent ID? (optional)', required: false },
    ],
    generateSteps: (answers, lang) => {
      const clubId = answers.clubId || 'XXXXXX';
      const clubName = answers.clubName || 'My Poker Club';
      const isHe = lang === 'he';
      return [
        {
          id: uid(), order: 1,
          title: isHe ? 'הורדת האפליקציה' : 'Download the App',
          description: isHe
            ? 'הורידו את ClubGG מ-Google Play או App Store. חינם לגמרי.'
            : 'Download ClubGG from Google Play or App Store. Completely free.',
          actionLabel: isHe ? 'לחצו על Install / התקן' : 'Tap Install',
          highlights: [
            { id: 1, label: isHe ? 'כפתור התקנה' : 'Install button', x: 30, y: 55, width: 40, height: 8, color: '#6366f1' },
          ],
          editable: true,
          mockupHtml: generateMockup({
            title: 'ClubGG',
            subtitle: isHe ? 'אפליקציית פוקר חינמית' : 'Free Poker App',
            icon: 'CG',
            iconColor: '#e53e3e',
            buttons: [{ text: isHe ? 'התקן' : 'Install', color: '#22c55e', highlight: true }],
            store: true,
          }),
        },
        {
          id: uid(), order: 2,
          title: isHe ? 'יצירת חשבון' : 'Create Account',
          description: isHe
            ? 'פתחו את האפליקציה והירשמו עם אימייל או חשבון Google/Facebook.'
            : 'Open the app and sign up with email or Google/Facebook account.',
          actionLabel: isHe ? 'לחצו Sign Up / הרשמה' : 'Tap Sign Up',
          highlights: [
            { id: 1, label: isHe ? 'הרשמה' : 'Sign Up', x: 25, y: 60, width: 50, height: 8, color: '#6366f1' },
            { id: 2, label: 'Google / Facebook', x: 25, y: 72, width: 50, height: 8, color: '#f59e0b' },
          ],
          editable: true,
          mockupHtml: generateMockup({
            title: 'ClubGG',
            subtitle: isHe ? 'ברוכים הבאים' : 'Welcome',
            icon: 'CG',
            iconColor: '#e53e3e',
            fields: [
              { placeholder: isHe ? 'אימייל' : 'Email' },
              { placeholder: isHe ? 'סיסמה' : 'Password' },
            ],
            buttons: [
              { text: isHe ? 'הרשמה' : 'Sign Up', color: '#6366f1', highlight: true },
              { text: isHe ? 'התחבר עם Google' : 'Sign in with Google', color: '#4285f4', highlight: false },
            ],
          }),
        },
        {
          id: uid(), order: 3,
          title: isHe ? 'מציאת המועדון' : 'Find the Club',
          description: isHe
            ? `בתפריט הראשי, לחצו על "Club" ואז על "Search" או "Join Club".`
            : `In the main menu, tap "Club" then "Search" or "Join Club".`,
          actionLabel: isHe ? 'לחצו על Club בתפריט' : 'Tap Club in menu',
          highlights: [
            { id: 1, label: isHe ? 'כפתור Club' : 'Club button', x: 60, y: 88, width: 20, height: 8, color: '#6366f1' },
          ],
          editable: true,
          mockupHtml: generateMockup({
            title: 'ClubGG',
            subtitle: isHe ? 'לובי ראשי' : 'Main Lobby',
            icon: 'CG',
            iconColor: '#e53e3e',
            bottomNav: [
              { text: isHe ? 'לובי' : 'Lobby', active: false },
              { text: isHe ? 'משחקים' : 'Games', active: false },
              { text: 'Club', active: true, highlight: true },
              { text: isHe ? 'פרופיל' : 'Profile', active: false },
            ],
            centerContent: isHe ? 'הלובי הראשי שלך' : 'Your Main Lobby',
          }),
        },
        {
          id: uid(), order: 4,
          title: isHe ? `הזנת קוד המועדון` : 'Enter Club ID',
          description: isHe
            ? `הקלידו את מספר המועדון: ${clubId} ולחצו Search / חיפוש.`
            : `Type the club number: ${clubId} and tap Search.`,
          actionLabel: isHe ? `הקלידו ${clubId}` : `Type ${clubId}`,
          highlights: [
            { id: 1, label: `Club ID: ${clubId}`, x: 15, y: 35, width: 70, height: 8, color: '#ef4444' },
            { id: 2, label: isHe ? 'חיפוש' : 'Search', x: 30, y: 48, width: 40, height: 8, color: '#6366f1' },
          ],
          editable: true,
          mockupHtml: generateMockup({
            title: isHe ? 'הצטרפות למועדון' : 'Join Club',
            subtitle: isHe ? 'הכנס קוד מועדון' : 'Enter Club ID',
            icon: 'CG',
            iconColor: '#e53e3e',
            fields: [
              { placeholder: 'Club ID', value: clubId, highlight: true },
            ],
            buttons: [
              { text: isHe ? 'חיפוש' : 'Search', color: '#6366f1', highlight: true },
            ],
          }),
        },
        {
          id: uid(), order: 5,
          title: isHe ? `הצטרפות ל-${clubName}` : `Join ${clubName}`,
          description: isHe
            ? `המועדון "${clubName}" יופיע בתוצאות. לחצו "Join" / הצטרף כדי להיכנס.`
            : `The club "${clubName}" will appear. Tap "Join" to enter.`,
          actionLabel: isHe ? 'לחצו Join / הצטרף' : 'Tap Join',
          highlights: [
            { id: 1, label: clubName, x: 10, y: 30, width: 80, height: 12, color: '#22c55e' },
            { id: 2, label: isHe ? 'הצטרף' : 'Join', x: 60, y: 34, width: 25, height: 6, color: '#6366f1' },
          ],
          editable: true,
          mockupHtml: generateMockup({
            title: isHe ? 'תוצאות חיפוש' : 'Search Results',
            subtitle: '',
            icon: 'CG',
            iconColor: '#e53e3e',
            listItems: [
              { title: clubName, subtitle: `ID: ${clubId}`, buttonText: isHe ? 'הצטרף' : 'Join', highlight: true },
            ],
          }),
        },
        {
          id: uid(), order: 6,
          title: isHe ? 'סיימתם! אתם בפנים' : "You're In!",
          description: isHe
            ? `מזל טוב! אתם עכשיו חלק מ-${clubName}. תוכלו לראות את השולחנות והטורנירים של המועדון.`
            : `Congratulations! You're now part of ${clubName}. You can see the club's tables and tournaments.`,
          actionLabel: isHe ? 'בחרו שולחן ושחקו!' : 'Pick a table and play!',
          highlights: [
            { id: 1, label: isHe ? 'שולחנות' : 'Tables', x: 10, y: 25, width: 80, height: 15, color: '#22c55e' },
            { id: 2, label: isHe ? 'טורנירים' : 'Tournaments', x: 10, y: 45, width: 80, height: 15, color: '#f59e0b' },
          ],
          editable: true,
          mockupHtml: generateMockup({
            title: clubName,
            subtitle: isHe ? 'ברוכים הבאים למועדון!' : 'Welcome to the Club!',
            icon: clubName.charAt(0).toUpperCase(),
            iconColor: '#22c55e',
            listItems: [
              { title: isHe ? 'שולחן NLH $0.5/$1' : 'NLH Table $0.5/$1', subtitle: isHe ? '6 שחקנים' : '6 Players', buttonText: isHe ? 'שב' : 'Sit' },
              { title: isHe ? 'שולחן PLO $1/$2' : 'PLO Table $1/$2', subtitle: isHe ? '4 שחקנים' : '4 Players', buttonText: isHe ? 'שב' : 'Sit' },
              { title: isHe ? 'טורניר ערב' : 'Evening Tournament', subtitle: isHe ? 'Buy-in: $10' : 'Buy-in: $10', buttonText: isHe ? 'הרשמה' : 'Register' },
            ],
          }),
        },
      ];
    },
  },

  {
    names: ['pppoker', 'pp poker'],
    platform: 'PPPoker',
    description: 'PPPoker club platform',
    questions: [
      { key: 'clubId', question_he: 'מה ה-Club ID שלך?', question_en: 'What is your Club ID?', required: true },
      { key: 'clubName', question_he: 'מה שם המועדון?', question_en: 'What is your club name?', required: true },
    ],
    generateSteps: (answers, lang) => {
      const clubId = answers.clubId || 'XXXXXX';
      const clubName = answers.clubName || 'My Club';
      const isHe = lang === 'he';
      return [
        { id: uid(), order: 1, title: isHe ? 'הורדת PPPoker' : 'Download PPPoker', description: isHe ? 'הורידו מ-Google Play / App Store' : 'Download from Google Play / App Store', actionLabel: 'Install', highlights: [{ id: 1, label: 'Install', x: 30, y: 55, width: 40, height: 8, color: '#6366f1' }], editable: true, mockupHtml: generateMockup({ title: 'PPPoker', subtitle: isHe ? 'פוקר עם חברים' : 'Poker with Friends', icon: 'PP', iconColor: '#3b82f6', buttons: [{ text: 'Install', color: '#22c55e', highlight: true }], store: true }) },
        { id: uid(), order: 2, title: isHe ? 'יצירת חשבון' : 'Create Account', description: isHe ? 'הירשמו עם אימייל' : 'Sign up with email', actionLabel: 'Sign Up', highlights: [{ id: 1, label: 'Sign Up', x: 25, y: 60, width: 50, height: 8, color: '#6366f1' }], editable: true, mockupHtml: generateMockup({ title: 'PPPoker', subtitle: isHe ? 'הרשמה' : 'Sign Up', icon: 'PP', iconColor: '#3b82f6', fields: [{ placeholder: 'Email' }, { placeholder: 'Password' }], buttons: [{ text: 'Sign Up', color: '#6366f1', highlight: true }] }) },
        { id: uid(), order: 3, title: isHe ? 'הצטרפות למועדון' : 'Join Club', description: isHe ? `לחצו Clubs > Join > הקלידו ${clubId}` : `Tap Clubs > Join > Type ${clubId}`, actionLabel: `Enter ${clubId}`, highlights: [{ id: 1, label: `ID: ${clubId}`, x: 15, y: 35, width: 70, height: 8, color: '#ef4444' }], editable: true, mockupHtml: generateMockup({ title: isHe ? 'הצטרפות' : 'Join Club', subtitle: '', icon: 'PP', iconColor: '#3b82f6', fields: [{ placeholder: 'Club ID', value: clubId, highlight: true }], buttons: [{ text: 'Join', color: '#6366f1', highlight: true }] }) },
        { id: uid(), order: 4, title: isHe ? `ברוכים הבאים ל-${clubName}!` : `Welcome to ${clubName}!`, description: isHe ? 'אתם בפנים! בחרו שולחן ושחקו' : "You're in! Pick a table and play", actionLabel: isHe ? 'שחקו!' : 'Play!', highlights: [{ id: 1, label: isHe ? 'שולחנות' : 'Tables', x: 10, y: 30, width: 80, height: 15, color: '#22c55e' }], editable: true, mockupHtml: generateMockup({ title: clubName, subtitle: isHe ? 'ברוכים הבאים!' : 'Welcome!', icon: clubName.charAt(0), iconColor: '#22c55e', listItems: [{ title: 'NLH $0.5/$1', subtitle: '6 Players', buttonText: 'Sit' }] }) },
      ];
    },
  },

  {
    names: ['pokerbros', 'poker bros'],
    platform: 'PokerBros',
    description: 'PokerBros club platform',
    questions: [
      { key: 'clubId', question_he: 'מה ה-Club ID שלך?', question_en: 'What is your Club ID?', required: true },
      { key: 'clubName', question_he: 'מה שם המועדון?', question_en: 'What is your club name?', required: true },
    ],
    generateSteps: (answers, lang) => {
      const clubId = answers.clubId || 'XXXXXX';
      const clubName = answers.clubName || 'My Club';
      const isHe = lang === 'he';
      return [
        { id: uid(), order: 1, title: isHe ? 'הורדת PokerBros' : 'Download PokerBros', description: isHe ? 'הורידו מ-Google Play / App Store' : 'Download from Google Play / App Store', actionLabel: 'Install', highlights: [{ id: 1, label: 'Install', x: 30, y: 55, width: 40, height: 8, color: '#6366f1' }], editable: true, mockupHtml: generateMockup({ title: 'PokerBros', subtitle: isHe ? 'פוקר אונליין' : 'Online Poker', icon: 'PB', iconColor: '#8b5cf6', buttons: [{ text: 'Install', color: '#22c55e', highlight: true }], store: true }) },
        { id: uid(), order: 2, title: isHe ? 'יצירת חשבון' : 'Create Account', description: isHe ? 'הירשמו' : 'Sign up', actionLabel: 'Sign Up', highlights: [{ id: 1, label: 'Sign Up', x: 25, y: 60, width: 50, height: 8, color: '#6366f1' }], editable: true, mockupHtml: generateMockup({ title: 'PokerBros', subtitle: 'Sign Up', icon: 'PB', iconColor: '#8b5cf6', fields: [{ placeholder: 'Email' }, { placeholder: 'Password' }], buttons: [{ text: 'Sign Up', color: '#8b5cf6', highlight: true }] }) },
        { id: uid(), order: 3, title: isHe ? 'הצטרפות למועדון' : 'Join Club', description: isHe ? `לחצו Club > Search > ${clubId}` : `Tap Club > Search > ${clubId}`, actionLabel: `Enter ${clubId}`, highlights: [{ id: 1, label: `ID: ${clubId}`, x: 15, y: 35, width: 70, height: 8, color: '#ef4444' }], editable: true, mockupHtml: generateMockup({ title: 'Join Club', subtitle: '', icon: 'PB', iconColor: '#8b5cf6', fields: [{ placeholder: 'Club ID', value: clubId, highlight: true }], buttons: [{ text: 'Join', color: '#8b5cf6', highlight: true }] }) },
        { id: uid(), order: 4, title: isHe ? `${clubName} - ברוכים הבאים!` : `Welcome to ${clubName}!`, description: isHe ? 'בחרו שולחן ושחקו' : 'Pick a table and play', actionLabel: 'Play!', highlights: [{ id: 1, label: 'Tables', x: 10, y: 30, width: 80, height: 15, color: '#22c55e' }], editable: true, mockupHtml: generateMockup({ title: clubName, subtitle: 'Welcome!', icon: clubName.charAt(0), iconColor: '#22c55e', listItems: [{ title: 'NLH $1/$2', subtitle: '6 Players', buttonText: 'Sit' }] }) },
      ];
    },
  },
];

// ---------------------------------------------------------------------------
// Generic platform fallback
// ---------------------------------------------------------------------------

function generateGenericSteps(request: string, answers: Record<string, string>, lang: 'he' | 'en'): ProjectStep[] {
  const isHe = lang === 'he';
  const appName = answers.appName || 'the App';
  const steps: ProjectStep[] = [
    {
      id: uid(), order: 1,
      title: isHe ? `הורדת ${appName}` : `Download ${appName}`,
      description: isHe ? `הורידו את ${appName} מחנות האפליקציות` : `Download ${appName} from your app store`,
      actionLabel: 'Install',
      highlights: [{ id: 1, label: 'Install', x: 30, y: 55, width: 40, height: 8, color: '#6366f1' }],
      editable: true,
      mockupHtml: generateMockup({ title: appName, subtitle: isHe ? 'הורדה' : 'Download', icon: appName.charAt(0).toUpperCase(), iconColor: '#6366f1', buttons: [{ text: 'Install', color: '#22c55e', highlight: true }], store: true }),
    },
    {
      id: uid(), order: 2,
      title: isHe ? 'יצירת חשבון' : 'Create Account',
      description: isHe ? 'הירשמו לאפליקציה' : 'Sign up for the app',
      actionLabel: 'Sign Up',
      highlights: [{ id: 1, label: 'Sign Up', x: 25, y: 60, width: 50, height: 8, color: '#6366f1' }],
      editable: true,
      mockupHtml: generateMockup({ title: appName, subtitle: 'Sign Up', icon: appName.charAt(0).toUpperCase(), iconColor: '#6366f1', fields: [{ placeholder: 'Email' }, { placeholder: 'Password' }], buttons: [{ text: 'Sign Up', color: '#6366f1', highlight: true }] }),
    },
    {
      id: uid(), order: 3,
      title: isHe ? 'הצעד העיקרי' : 'Main Action',
      description: request,
      actionLabel: isHe ? 'לחצו כאן' : 'Tap here',
      highlights: [{ id: 1, label: isHe ? 'פעולה' : 'Action', x: 20, y: 40, width: 60, height: 10, color: '#ef4444' }],
      editable: true,
      mockupHtml: generateMockup({ title: appName, subtitle: '', icon: appName.charAt(0).toUpperCase(), iconColor: '#6366f1', centerContent: request, buttons: [{ text: isHe ? 'המשך' : 'Continue', color: '#6366f1', highlight: true }] }),
    },
    {
      id: uid(), order: 4,
      title: isHe ? 'סיימתם!' : 'Done!',
      description: isHe ? 'הפעולה הושלמה בהצלחה' : 'Action completed successfully',
      actionLabel: isHe ? 'מעולה!' : 'Great!',
      highlights: [{ id: 1, label: isHe ? 'הצלחה' : 'Success', x: 25, y: 35, width: 50, height: 10, color: '#22c55e' }],
      editable: true,
      mockupHtml: generateMockup({ title: appName, subtitle: isHe ? 'הושלם!' : 'Complete!', icon: '\u2713', iconColor: '#22c55e', centerContent: isHe ? 'הפעולה הושלמה בהצלחה!' : 'Action completed successfully!' }),
    },
  ];
  return steps;
}

// ---------------------------------------------------------------------------
// Mockup generator - creates phone-screen-like HTML/SVG
// ---------------------------------------------------------------------------

interface MockupConfig {
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  fields?: Array<{ placeholder: string; value?: string; highlight?: boolean }>;
  buttons?: Array<{ text: string; color: string; highlight?: boolean }>;
  bottomNav?: Array<{ text: string; active?: boolean; highlight?: boolean }>;
  listItems?: Array<{ title: string; subtitle: string; buttonText?: string; highlight?: boolean }>;
  centerContent?: string;
  store?: boolean;
}

function generateMockup(config: MockupConfig): string {
  const fieldsHtml = (config.fields || []).map(f => `
    <div style="margin:8px 24px;padding:14px 16px;background:${f.highlight ? '#1e1b4b' : '#1a1a2e'};border:2px solid ${f.highlight ? '#6366f1' : '#2a2a45'};border-radius:12px;color:${f.value ? '#e2e8f0' : '#64748b'};font-size:15px;">
      ${f.value || f.placeholder}
    </div>
  `).join('');

  const buttonsHtml = (config.buttons || []).map(b => `
    <div style="margin:8px 24px;padding:14px;background:${b.color};border-radius:12px;color:white;font-weight:600;text-align:center;font-size:15px;${b.highlight ? 'box-shadow:0 0 20px ' + b.color + '60;' : ''}">
      ${b.text}
    </div>
  `).join('');

  const navHtml = config.bottomNav ? `
    <div style="position:absolute;bottom:0;left:0;right:0;display:flex;background:#1a1a2e;border-top:1px solid #2a2a45;padding:12px 0 20px;">
      ${config.bottomNav.map(n => `
        <div style="flex:1;text-align:center;font-size:11px;color:${n.active ? '#818cf8' : '#64748b'};font-weight:${n.active ? '600' : '400'};${n.highlight ? 'position:relative;' : ''}">
          ${n.text}
          ${n.highlight ? '<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);width:8px;height:8px;background:#6366f1;border-radius:50%;"></div>' : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  const listHtml = (config.listItems || []).map(item => `
    <div style="margin:8px 24px;padding:16px;background:#1a1a2e;border:1px solid ${item.highlight ? '#6366f1' : '#2a2a45'};border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="color:#e2e8f0;font-size:14px;font-weight:600;">${item.title}</div>
        <div style="color:#64748b;font-size:12px;margin-top:2px;">${item.subtitle}</div>
      </div>
      ${item.buttonText ? `<div style="padding:8px 16px;background:#6366f1;border-radius:8px;color:white;font-size:12px;font-weight:600;">${item.buttonText}</div>` : ''}
    </div>
  `).join('');

  const centerHtml = config.centerContent ? `
    <div style="padding:40px 24px;text-align:center;color:#94a3b8;font-size:16px;line-height:1.6;">
      ${config.centerContent}
    </div>
  ` : '';

  const storeHtml = config.store ? `
    <div style="display:flex;gap:8px;justify-content:center;margin:16px 24px;">
      <div style="padding:10px 20px;background:#1a1a2e;border:1px solid #2a2a45;border-radius:8px;color:#94a3b8;font-size:11px;text-align:center;">
        <div style="font-size:8px;color:#64748b;">GET IT ON</div>
        <div style="font-weight:600;">Google Play</div>
      </div>
      <div style="padding:10px 20px;background:#1a1a2e;border:1px solid #2a2a45;border-radius:8px;color:#94a3b8;font-size:11px;text-align:center;">
        <div style="font-size:8px;color:#64748b;">Download on the</div>
        <div style="font-weight:600;">App Store</div>
      </div>
    </div>
  ` : '';

  return `
    <div style="width:360px;height:720px;background:#0f0f1a;border-radius:32px;overflow:hidden;font-family:system-ui,sans-serif;position:relative;border:3px solid #2a2a45;">
      <!-- Status bar -->
      <div style="padding:8px 20px;display:flex;justify-content:space-between;font-size:11px;color:#64748b;">
        <span>9:41</span>
        <span>100%</span>
      </div>
      <!-- Header -->
      <div style="padding:16px 24px;display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;background:${config.iconColor};border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;">${config.icon}</div>
        <div>
          <div style="color:#e2e8f0;font-size:18px;font-weight:700;">${config.title}</div>
          ${config.subtitle ? `<div style="color:#64748b;font-size:13px;">${config.subtitle}</div>` : ''}
        </div>
      </div>
      ${centerHtml}
      ${fieldsHtml}
      ${buttonsHtml}
      ${storeHtml}
      ${listHtml}
      ${navHtml}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Smart Engine
// ---------------------------------------------------------------------------

export class SmartEngine {

  analyze(input: SmartInput): SmartProject {
    const lang = input.language || 'he';
    const request = input.request.toLowerCase();
    const answers = input.answers || {};

    // Try to match a known platform
    const matched = PLATFORMS.find(p =>
      p.names.some(name => request.includes(name))
    );

    if (matched) {
      // Check if we have required answers
      const missingQuestions = matched.questions
        .filter(q => q.required && !answers[q.key]);

      if (missingQuestions.length > 0 && Object.keys(answers).length === 0) {
        return {
          id: uid(),
          title: `${matched.platform} Club`,
          description: input.request,
          platform: matched.platform,
          language: lang,
          steps: [],
          clarifyingQuestions: missingQuestions.map(q => lang === 'he' ? q.question_he : q.question_en),
          ready: false,
          createdAt: new Date().toISOString(),
        };
      }

      // Generate steps with whatever answers we have
      const steps = matched.generateSteps(answers, lang);
      return {
        id: uid(),
        title: answers.clubName
          ? `${answers.clubName} - ${matched.platform}`
          : `${matched.platform} Club`,
        description: input.request,
        platform: matched.platform,
        language: lang,
        steps,
        ready: true,
        createdAt: new Date().toISOString(),
      };
    }

    // Generic fallback
    const genericQuestions = [];
    if (!answers.appName) {
      genericQuestions.push(lang === 'he' ? 'מה שם האפליקציה/הפלטפורמה?' : 'What is the app/platform name?');
    }

    if (genericQuestions.length > 0 && Object.keys(answers).length === 0) {
      return {
        id: uid(),
        title: 'ExplainIt Project',
        description: input.request,
        platform: 'generic',
        language: lang,
        steps: [],
        clarifyingQuestions: genericQuestions,
        ready: false,
        createdAt: new Date().toISOString(),
      };
    }

    const steps = generateGenericSteps(input.request, answers, lang);
    return {
      id: uid(),
      title: answers.appName || 'ExplainIt Project',
      description: input.request,
      platform: 'generic',
      language: lang,
      steps,
      ready: true,
      createdAt: new Date().toISOString(),
    };
  }

  generateStepMockupImage(step: ProjectStep, outputDir: string): string {
    if (!step.mockupHtml) return '';
    fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, `step_${step.id}.html`);
    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#080810;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style>
</head><body>${step.mockupHtml}</body></html>`;
    fs.writeFileSync(filePath, fullHtml);
    return filePath;
  }
}
