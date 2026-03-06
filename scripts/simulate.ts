/**
 * ExplainIt Full Simulation Script
 * Tests all pipeline options against a local demo server
 */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CaptureEngine } from '../src/lib/capture-engine';
import { VideoProducer } from '../src/lib/video-producer';
import { PDFGenerator } from '../src/lib/pdf-generator';
import { Pipeline } from '../src/lib/pipeline';

// ─── Demo Server ────────────────────────────────────────────────────────────
function createDemoServer(): http.Server {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const pages: Record<string, string> = {
      '/': `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><title>MyApp - Home</title>
<style>
  * { margin:0; box-sizing:border-box; font-family:system-ui,sans-serif; }
  body { background:#0f172a; color:#e2e8f0; }
  nav { background:#1e293b; padding:16px 24px; display:flex; gap:20px; align-items:center; }
  nav a { color:#94a3b8; text-decoration:none; font-size:14px; }
  nav a:hover { color:#f1f5f9; }
  .logo { font-size:20px; font-weight:bold; color:#818cf8; margin-left:auto; }
  .hero { text-align:center; padding:80px 20px; }
  .hero h1 { font-size:48px; background:linear-gradient(135deg,#818cf8,#f59e0b); -webkit-background-clip:text; color:transparent; margin-bottom:16px; }
  .hero p { font-size:18px; color:#94a3b8; max-width:600px; margin:0 auto 32px; }
  .btn { display:inline-block; background:#6366f1; color:white; padding:14px 32px; border-radius:12px; font-weight:600; cursor:pointer; border:none; font-size:16px; }
  .btn:hover { background:#818cf8; }
  .features { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; padding:40px 24px; max-width:1000px; margin:0 auto; }
  .card { background:#1e293b; border-radius:16px; padding:24px; border:1px solid #334155; }
  .card h3 { color:#f1f5f9; margin-bottom:8px; }
  .card p { color:#94a3b8; font-size:14px; }
  footer { text-align:center; padding:24px; color:#475569; font-size:12px; border-top:1px solid #1e293b; }
</style></head>
<body>
  <nav>
    <span class="logo">MyApp</span>
    <a href="/">Home</a>
    <a href="/dashboard">Dashboard</a>
    <a href="/settings">Settings</a>
    <a href="/pricing">Pricing</a>
    <a href="/about">About</a>
  </nav>
  <div class="hero">
    <h1>Build Better Products</h1>
    <p>MyApp helps you manage projects, track tasks, and collaborate with your team efficiently.</p>
    <button class="btn" id="cta-signup">Start Free Trial</button>
  </div>
  <div class="features">
    <div class="card"><h3>Task Management</h3><p>Create, assign, and track tasks across your team.</p></div>
    <div class="card"><h3>Real-time Collaboration</h3><p>Work together with live updates and chat.</p></div>
    <div class="card"><h3>Analytics Dashboard</h3><p>Gain insights from data-driven reports.</p></div>
  </div>
  <footer>MyApp 2026 - All rights reserved</footer>
</body></html>`,

      '/dashboard': `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><title>MyApp - Dashboard</title>
<style>
  * { margin:0; box-sizing:border-box; font-family:system-ui,sans-serif; }
  body { background:#0f172a; color:#e2e8f0; }
  .topbar { background:#1e293b; padding:12px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; }
  .topbar h2 { font-size:18px; }
  .sidebar { position:fixed; right:0; top:48px; width:220px; background:#1e293b; height:100%; padding:20px; border-left:1px solid #334155; }
  .sidebar a { display:block; color:#94a3b8; padding:10px; border-radius:8px; margin-bottom:4px; text-decoration:none; }
  .sidebar a:hover { background:#334155; color:#f1f5f9; }
  .main { margin-right:220px; padding:24px; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
  .stat { background:#1e293b; border-radius:12px; padding:20px; border:1px solid #334155; }
  .stat .num { font-size:32px; font-weight:bold; color:#818cf8; }
  .stat .label { color:#94a3b8; font-size:12px; margin-top:4px; }
  .table { background:#1e293b; border-radius:12px; border:1px solid #334155; overflow:hidden; }
  .table-header { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; padding:12px 16px; background:#334155; font-size:12px; color:#94a3b8; }
  .table-row { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; padding:12px 16px; border-top:1px solid #334155; font-size:14px; }
  .badge { padding:4px 8px; border-radius:6px; font-size:11px; display:inline-block; }
  .badge-green { background:#065f46; color:#6ee7b7; }
  .badge-yellow { background:#78350f; color:#fcd34d; }
  .badge-red { background:#7f1d1d; color:#fca5a5; }
  input[type="search"] { background:#0f172a; border:1px solid #334155; color:#e2e8f0; padding:8px 16px; border-radius:8px; width:300px; }
</style></head>
<body>
  <div class="topbar">
    <h2>Dashboard</h2>
    <input type="search" placeholder="Search tasks..." />
  </div>
  <div class="sidebar">
    <a href="/dashboard">Overview</a>
    <a href="/dashboard">My Tasks</a>
    <a href="/dashboard">Team</a>
    <a href="/dashboard">Reports</a>
    <a href="/settings">Settings</a>
  </div>
  <div class="main">
    <div class="stats">
      <div class="stat"><div class="num">24</div><div class="label">Active Tasks</div></div>
      <div class="stat"><div class="num">8</div><div class="label">Completed Today</div></div>
      <div class="stat"><div class="num">3</div><div class="label">Overdue</div></div>
      <div class="stat"><div class="num">12</div><div class="label">Team Members</div></div>
    </div>
    <div class="table">
      <div class="table-header"><span>Task</span><span>Assignee</span><span>Status</span><span>Due</span></div>
      <div class="table-row"><span>Design landing page</span><span>Sarah</span><span><span class="badge badge-green">Done</span></span><span>Mar 1</span></div>
      <div class="table-row"><span>API integration</span><span>David</span><span><span class="badge badge-yellow">In Progress</span></span><span>Mar 5</span></div>
      <div class="table-row"><span>Bug fix: login</span><span>Alex</span><span><span class="badge badge-red">Overdue</span></span><span>Feb 28</span></div>
      <div class="table-row"><span>User testing</span><span>Maya</span><span><span class="badge badge-yellow">In Progress</span></span><span>Mar 8</span></div>
    </div>
  </div>
</body></html>`,

      '/settings': `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><title>MyApp - Settings</title>
<style>
  * { margin:0; box-sizing:border-box; font-family:system-ui,sans-serif; }
  body { background:#0f172a; color:#e2e8f0; padding:24px; }
  h1 { font-size:24px; margin-bottom:24px; }
  .section { background:#1e293b; border-radius:12px; padding:24px; margin-bottom:16px; border:1px solid #334155; }
  .section h3 { margin-bottom:16px; font-size:16px; }
  label { display:block; margin-bottom:12px; font-size:14px; color:#94a3b8; }
  input[type="text"], input[type="email"] { width:100%; background:#0f172a; border:1px solid #334155; color:#e2e8f0; padding:10px 14px; border-radius:8px; margin-top:4px; }
  .toggle { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #334155; }
  .toggle-switch { width:44px; height:24px; background:#334155; border-radius:12px; position:relative; cursor:pointer; }
  .toggle-switch.on { background:#6366f1; }
  .toggle-switch::after { content:''; position:absolute; width:20px; height:20px; background:white; border-radius:50%; top:2px; right:2px; transition:0.2s; }
  .toggle-switch.on::after { right:22px; }
  .btn { background:#6366f1; color:white; padding:10px 24px; border-radius:8px; border:none; cursor:pointer; font-weight:600; margin-top:16px; }
  select { background:#0f172a; border:1px solid #334155; color:#e2e8f0; padding:10px; border-radius:8px; margin-top:4px; }
</style></head>
<body>
  <h1>Settings</h1>
  <div class="section">
    <h3>Profile</h3>
    <label>Full Name <input type="text" value="John Doe" /></label>
    <label>Email <input type="email" value="john@example.com" /></label>
    <button class="btn">Save Changes</button>
  </div>
  <div class="section">
    <h3>Notifications</h3>
    <div class="toggle"><span>Email notifications</span><div class="toggle-switch on"></div></div>
    <div class="toggle"><span>Push notifications</span><div class="toggle-switch"></div></div>
    <div class="toggle"><span>Weekly summary</span><div class="toggle-switch on"></div></div>
  </div>
  <div class="section">
    <h3>Language</h3>
    <label>Display language <select><option>English</option><option>Hebrew</option><option>Arabic</option></select></label>
  </div>
</body></html>`,

      '/pricing': `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><title>MyApp - Pricing</title>
<style>
  * { margin:0; box-sizing:border-box; font-family:system-ui,sans-serif; }
  body { background:#0f172a; color:#e2e8f0; padding:40px 24px; }
  h1 { text-align:center; font-size:36px; margin-bottom:8px; }
  .subtitle { text-align:center; color:#94a3b8; margin-bottom:40px; }
  .plans { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; max-width:900px; margin:0 auto; }
  .plan { background:#1e293b; border-radius:16px; padding:32px; border:1px solid #334155; text-align:center; }
  .plan.popular { border-color:#6366f1; position:relative; }
  .plan.popular::before { content:'Popular'; position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:#6366f1; color:white; padding:4px 16px; border-radius:8px; font-size:12px; font-weight:600; }
  .plan h3 { font-size:20px; margin-bottom:8px; }
  .price { font-size:42px; font-weight:bold; margin:16px 0; }
  .price span { font-size:16px; color:#94a3b8; font-weight:400; }
  .plan ul { list-style:none; padding:0; margin:16px 0 24px; text-align:right; }
  .plan li { padding:8px 0; color:#94a3b8; font-size:14px; border-bottom:1px solid #334155; }
  .btn { display:block; background:#6366f1; color:white; padding:12px; border-radius:10px; border:none; font-weight:600; font-size:15px; cursor:pointer; width:100%; }
  .btn-outline { background:transparent; border:1px solid #334155; color:#94a3b8; }
</style></head>
<body>
  <h1>Pricing Plans</h1>
  <p class="subtitle">Choose the right plan for your team</p>
  <div class="plans">
    <div class="plan">
      <h3>Starter</h3>
      <div class="price">$0 <span>/month</span></div>
      <ul><li>5 projects</li><li>2 team members</li><li>Basic analytics</li><li>Email support</li></ul>
      <button class="btn btn-outline">Get Started</button>
    </div>
    <div class="plan popular">
      <h3>Pro</h3>
      <div class="price">$29 <span>/month</span></div>
      <ul><li>Unlimited projects</li><li>10 team members</li><li>Advanced analytics</li><li>Priority support</li></ul>
      <button class="btn">Start Free Trial</button>
    </div>
    <div class="plan">
      <h3>Enterprise</h3>
      <div class="price">$99 <span>/month</span></div>
      <ul><li>Unlimited everything</li><li>Unlimited members</li><li>Custom integrations</li><li>24/7 phone support</li></ul>
      <button class="btn btn-outline">Contact Sales</button>
    </div>
  </div>
</body></html>`,

      '/about': `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><title>MyApp - About</title>
<style>
  * { margin:0; box-sizing:border-box; font-family:system-ui,sans-serif; }
  body { background:#0f172a; color:#e2e8f0; }
  .hero { text-align:center; padding:60px 24px; }
  .hero h1 { font-size:36px; margin-bottom:16px; }
  .hero p { color:#94a3b8; max-width:600px; margin:0 auto; line-height:1.6; }
  .team { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; padding:40px 24px; max-width:800px; margin:0 auto; }
  .member { background:#1e293b; border-radius:16px; padding:24px; text-align:center; border:1px solid #334155; }
  .avatar { width:80px; height:80px; border-radius:50%; background:#334155; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; font-size:32px; }
  .member h4 { margin-bottom:4px; }
  .member p { color:#94a3b8; font-size:13px; }
  .contact { text-align:center; padding:40px; }
  .contact a { color:#818cf8; }
</style></head>
<body>
  <div class="hero">
    <h1>About MyApp</h1>
    <p>We're on a mission to make project management simple, beautiful, and accessible to teams of all sizes. Founded in 2024, we serve over 10,000 teams worldwide.</p>
  </div>
  <div class="team">
    <div class="member"><div class="avatar">S</div><h4>Sarah Cohen</h4><p>CEO & Co-Founder</p></div>
    <div class="member"><div class="avatar">D</div><h4>David Levi</h4><p>CTO & Co-Founder</p></div>
    <div class="member"><div class="avatar">M</div><h4>Maya Rosen</h4><p>Head of Design</p></div>
  </div>
  <div class="contact"><p>Contact us at <a href="mailto:hello@myapp.com">hello@myapp.com</a></p></div>
</body></html>`,
    };

    const html = pages[req.url || '/'] || `<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>`;
    if (!pages[req.url || '/']) res.statusCode = 404;
    res.end(html);
  });
}

// ─── Simulation Runners ─────────────────────────────────────────────────────

async function simulateCapture(serverUrl: string) {
  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION 1: Capture Engine Only');
  console.log('='.repeat(70));

  const engine = new CaptureEngine();

  // Test screen discovery
  console.log('\n--- discoverScreens ---');
  const screens = await engine.discoverScreens(serverUrl);
  console.log(`Found ${screens.length} screens:`);
  for (const s of screens) {
    console.log(`  [${s.route}] ${s.name}`);
  }

  // Test full capture with portrait viewport
  console.log('\n--- captureUrl (portrait, max 5 screens) ---');
  const outputDir = path.resolve('exports/sim-screenshots');
  fs.mkdirSync(outputDir, { recursive: true });

  const result = await engine.captureUrl(serverUrl, {
    maxScreens: 5,
    viewport: { width: 1080, height: 1920 },
    outputDir,
  });

  console.log(`Captured ${result.screens.length} screens:`);
  for (const s of result.screens) {
    const size = fs.existsSync(s.screenshotPath)
      ? `${Math.round(fs.statSync(s.screenshotPath).size / 1024)}KB`
      : 'MISSING';
    console.log(`  ${s.name} (${s.route}) - ${s.elements.length} elements - ${size}`);
    for (const el of s.elements.slice(0, 3)) {
      console.log(`    [${el.type}] "${el.label}" at (${el.bounds.x},${el.bounds.y})`);
    }
  }

  console.log(`\nFlows: ${result.flows.length}`);
  for (const f of result.flows) {
    console.log(`  ${f.name}: ${f.steps.length} steps`);
  }

  return result;
}

async function simulateVideoProduction(captureResult: { screens: import('../src/lib/capture-engine').ScreenInfo[] }) {
  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION 2: Video Producer');
  console.log('='.repeat(70));

  const producer = new VideoProducer();
  const outputDir = path.resolve('exports/sim-videos');
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate individual videos
  console.log('\n--- Individual screen videos ---');
  const videos = [];
  for (const screen of captureResult.screens) {
    const video = await producer.generateVideo(screen, {
      outputDir,
      language: 'he',
      width: 1080,
      height: 1920,
    });
    videos.push(video);
    const size = fs.existsSync(video.videoPath)
      ? `${Math.round(fs.statSync(video.videoPath).size / 1024)}KB`
      : 'MISSING';
    console.log(`  ${video.screenName}: ${video.videoPath} (${size})`);
  }

  // Generate overview video
  console.log('\n--- Overview video ---');
  const overview = await producer.generateOverviewVideo(captureResult.screens, 'MyApp Demo');
  console.log(`  Overview: ${overview.videoPath}`);

  // Generate demo page
  console.log('\n--- Demo page ---');
  const allVideos = [...videos, overview];
  const demoPath = await producer.generateDemoPage(allVideos);
  console.log(`  Demo page: ${demoPath}`);

  return { videos: allVideos, demoPath };
}

async function simulatePDFGeneration(captureResult: { screens: import('../src/lib/capture-engine').ScreenInfo[] }) {
  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION 3: PDF Generator');
  console.log('='.repeat(70));

  const generator = new PDFGenerator();
  const outputDir = path.resolve('exports/sim-docs');
  fs.mkdirSync(outputDir, { recursive: true });

  // Hebrew PDF
  console.log('\n--- Hebrew PDF ---');
  const heResult = await generator.generateGuide(captureResult.screens, {
    title: 'MyApp - Guide',
    language: 'he',
    outputDir,
    includeAnnotations: true,
  });
  const heSize = fs.existsSync(heResult.pdfPath)
    ? `${Math.round(fs.statSync(heResult.pdfPath).size / 1024)}KB`
    : 'MISSING';
  console.log(`  PDF: ${heResult.pdfPath} (${heSize}, ${heResult.pageCount} pages)`);
  console.log(`  MD:  ${heResult.mdPath}`);

  // English PDF
  console.log('\n--- English PDF ---');
  const enResult = await generator.generateGuide(captureResult.screens, {
    title: 'MyApp - User Guide',
    language: 'en',
    outputDir,
    includeAnnotations: true,
  });
  const enSize = fs.existsSync(enResult.pdfPath)
    ? `${Math.round(fs.statSync(enResult.pdfPath).size / 1024)}KB`
    : 'MISSING';
  console.log(`  PDF: ${enResult.pdfPath} (${enSize}, ${enResult.pageCount} pages)`);
  console.log(`  MD:  ${enResult.mdPath}`);

  return { heResult, enResult };
}

async function simulateFullPipeline(serverUrl: string) {
  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION 4: Full Pipeline (URL input, Portrait, Hebrew)');
  console.log('='.repeat(70));

  const statuses: string[] = [];
  const pipeline = new Pipeline((status) => {
    const line = `  [${status.stage}] ${status.progress}% - ${status.currentAgent}: ${status.message}`;
    statuses.push(line);
    console.log(line);
  });

  console.log('\n--- Running pipeline ---');
  const result = await pipeline.run({
    type: 'url',
    value: serverUrl,
    projectName: 'MyApp Production',
    language: 'he',
    orientation: 'portrait',
    maxScreens: 5,
  });

  console.log(`\n--- Result: ${result.status} ---`);
  console.log(`  Screens: ${result.capture?.screens.length || 0}`);
  console.log(`  Videos:  ${result.videos?.length || 0}`);
  console.log(`  PDF:     ${result.pdf ? `${result.pdf.pageCount} pages` : 'none'}`);
  console.log(`  Report:  ${result.reportPath}`);
  if (result.errors.length > 0) {
    console.log(`  Errors:`);
    for (const e of result.errors) console.log(`    - ${e}`);
  }

  return result;
}

async function simulateLandscapePipeline(serverUrl: string) {
  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION 5: Full Pipeline (URL input, Landscape, English)');
  console.log('='.repeat(70));

  const pipeline = new Pipeline((status) => {
    console.log(`  [${status.stage}] ${status.progress}% - ${status.message}`);
  });

  const result = await pipeline.run({
    type: 'url',
    value: serverUrl,
    projectName: 'MyApp Landscape',
    language: 'en',
    orientation: 'landscape',
    maxScreens: 3,
  });

  console.log(`\n--- Result: ${result.status} ---`);
  console.log(`  Screens: ${result.capture?.screens.length || 0}`);
  console.log(`  Videos:  ${result.videos?.length || 0}`);
  console.log(`  PDF:     ${result.pdf ? `${result.pdf.pageCount} pages` : 'none'}`);

  return result;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║          ExplainIt - Full System Simulation                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Start demo server
  const server = createDemoServer();
  const serverUrl = await new Promise<string>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve(`http://127.0.0.1:${addr.port}`);
      }
    });
  });
  console.log(`\nDemo server running at: ${serverUrl}`);

  // Clean exports
  const exportsDir = path.resolve('exports');
  if (fs.existsSync(exportsDir)) {
    fs.rmSync(exportsDir, { recursive: true, force: true });
  }

  try {
    // Sim 1: Capture only
    const captureResult = await simulateCapture(serverUrl);

    // Sim 2: Video production
    await simulateVideoProduction(captureResult);

    // Sim 3: PDF generation (both languages)
    await simulatePDFGeneration(captureResult);

    // Sim 4: Full pipeline (portrait, Hebrew)
    await simulateFullPipeline(serverUrl);

    // Sim 5: Full pipeline (landscape, English)
    await simulateLandscapePipeline(serverUrl);

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('FINAL EXPORT SUMMARY');
    console.log('='.repeat(70));

    function listDir(dir: string, indent = '  ') {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir).sort();
      for (const item of items) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          console.log(`${indent}${item}/`);
          listDir(full, indent + '  ');
        } else {
          const kb = Math.round(stat.size / 1024);
          console.log(`${indent}${item} (${kb}KB)`);
        }
      }
    }

    console.log('\nexports/');
    listDir(exportsDir);

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║          ALL SIMULATIONS COMPLETE                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

  } catch (err) {
    console.error('\nSIMULATION ERROR:', err);
  } finally {
    server.close();
  }
}

main().catch(console.error);
