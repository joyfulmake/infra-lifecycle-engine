/**
 * Full Phase 1 + Phase 2 walk-through screenshot script.
 * Output: store-screenshots/ (1366×768 PNG)
 * Run: node scripts/take-store-screenshots.mjs
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'store-screenshots');
const BASE_URL = 'https://opsmanifest.netlify.app';
const W = 1366;
const H = 768;

if (fs.existsSync(OUT_DIR)) {
  fs.readdirSync(OUT_DIR).forEach(f => fs.unlinkSync(path.join(OUT_DIR, f)));
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const wait = ms => new Promise(r => setTimeout(r, ms));

// Inject professional auth before page loads
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('opsmanifest_auth', JSON.stringify({
    email: 'demo@opsmanifest.local',
    plan: 'professional',
    buildsUsed: 0,
    createdAt: Date.now(),
  }));
});

await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
await wait(2500);

let shotIndex = 0;
async function shot(label) {
  shotIndex++;
  const filename = `${String(shotIndex).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
  console.log(`  [${shotIndex}] ${filename}`);
  return filename;
}

// Click a .tab-btn by label text (disabled tabs are skipped)
async function clickTab(label) {
  const ok = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('.tab-btn')].find(
      b => b.textContent.trim().includes(label) && !b.disabled
    );
    if (btn) { btn.click(); return true; }
    return false;
  }, label);
  await wait(1000);
  if (!ok) console.log(`  ⚠ Tab "${label}" not clickable (locked or not found)`);
  return ok;
}

// Click any visible button by exact or partial text
async function clickButton(text) {
  const ok = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll('button')].find(
      b => !b.disabled && (b.textContent.trim() === text || b.textContent.trim().startsWith(text))
    );
    if (btn) { btn.click(); return true; }
    return false;
  }, text);
  await wait(600);
  return ok;
}

// ═══════════════════════════════════════════════════════
// PHASE 1 — PLATFORM TOPOLOGY
// ═══════════════════════════════════════════════════════
console.log('\n── Phase 1: Stack selection ──');

// Select HW / OS / DB / App via ElementHandle.select() (triggers React onChange)
const handles = await page.$$('select');
for (const h of handles) {
  const opts = await h.evaluate(el => [...el.options].map(o => o.value));
  if (opts.some(v => v.includes('PowerEdge')))   { await h.select('Dell PowerEdge (x86_64)'); await wait(300); }
  else if (opts.some(v => v.includes('RHEL')))    { await h.select('RHEL 9.x'); await wait(300); }
  else if (opts.some(v => v.includes('PostgreSQL'))) { await h.select('PostgreSQL 16'); await wait(300); }
  else if (opts.some(v => v.includes('Spring Boot'))) { await h.select('Spring Boot 3.x'); await wait(300); }
}
await wait(500);

// Screenshot 1: Phase 1 — full sidebar workflow visible (pre-build)
await shot('phase1-workflow-overview');

// Build Environment
await clickButton('Build Environment');
await wait(2000);
await page.keyboard.press('Escape');
await wait(500);

// Screenshot 2: Post-build Executive Summary — KPI tiles + milestone + stack
await shot('exec-summary-post-build');

// ═══════════════════════════════════════════════════════
// AI SMART SCAN
// ═══════════════════════════════════════════════════════
console.log('\n── AI Smart Scan ──');
await clickButton('Run AI Smart Scan');
await wait(5500); // wait for staged animation to complete

// Screenshot 3: AI Smart Scan results modal
await shot('ai-scan-results');

// Apply scan results → scanComplete = true, unlocks System Design
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b =>
    b.textContent.includes('Apply Results') || b.textContent.includes('Unlock Design')
  );
  if (btn) btn.click();
});
await wait(1200);

// ═══════════════════════════════════════════════════════
// SYSTEM DESIGN — Generate Task Plan → designApplied = true
// ═══════════════════════════════════════════════════════
console.log('\n── System Design ──');
await clickTab('System Design');

// Screenshot 4: System Design — 8 sections pre-filled from stack
await shot('system-design-filled');

// Click "Generate Task Plan" → applyDesign() → designApplied = true
const generatedTasks = await clickButton('Generate Task Plan');
if (!generatedTasks) await clickButton('Regenerate Task Plan');
await wait(1500);

console.log('designApplied state:', await page.evaluate(() =>
  document.body.textContent.includes('Generate Implementation Task Plan')
));

// ═══════════════════════════════════════════════════════
// PHASE 2 — INJECT INCIDENTS + UUM → phase2Active = true
// ═══════════════════════════════════════════════════════
console.log('\n── Phase 2: Inject incidents ──');

// The "Inject to Build" button is in the sidebar — click it
const injected = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(
    b => !b.disabled && b.textContent.trim().startsWith('Inject to Build')
  );
  if (btn) { btn.click(); return btn.textContent.trim(); }
  return null;
});
console.log('Inject button found:', injected);
await wait(1500);

// ═══════════════════════════════════════════════════════
// TAKE SCREENSHOTS OF ALL UNLOCKED TABS
// ═══════════════════════════════════════════════════════
console.log('\n── Capturing all unlocked tabs ──');

// Screenshot 5: Gantt chart (requires designApplied)
const ganttOk = await clickTab('Gantt');
if (ganttOk) {
  await shot('gantt-task-timeline');
} else {
  console.log('  ⚠ Gantt locked, skipping');
}

// Screenshot 6: RAID log (requires phase2Active)
const raidOk = await clickTab('RAID');
if (raidOk) {
  await shot('raid-log');
} else {
  console.log('  ⚠ RAID locked, skipping');
}

// Screenshot 7: RTM — Requirements Traceability Matrix (requires phase2Active)
const rtmOk = await clickTab('RTM');
if (rtmOk) {
  await shot('rtm-traceability');
} else {
  console.log('  ⚠ RTM locked, skipping');
}

// Screenshot 8: Infrastructure Topology Diagram (with incident fault indicators)
await clickTab('Infra Diagram');
await shot('infra-topology-diagram');

// Screenshot 9: Roles — Project RACI table
await clickTab('Roles');
await shot('roles-raci-table');

// Screenshot 10: CMDB inventory
await clickTab('CMDB');
await shot('cmdb-inventory');

await browser.close();

console.log('\n── Done ──');
const files = fs.readdirSync(OUT_DIR).sort();
files.forEach(f => {
  const kb = Math.round(fs.statSync(path.join(OUT_DIR, f)).size / 1024);
  console.log(`  ${f}  (${kb}KB)`);
});
console.log(`\nTotal: ${files.length} screenshots in ${OUT_DIR}`);
