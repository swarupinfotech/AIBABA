import { promises as fs } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import type { ReportBlock, ReportDocument } from "@/services/ai/schemas";

const BROWSER_CANDIDATES = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean) as string[];

const BASE_ARGS = ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=medium"];

interface BrowserTarget {
  executablePath: string;
  args: string[];
}

/**
 * Serverless runtimes (Vercel/Lambda) have no system browser. There we use the
 * packaged @sparticuz/chromium build, which unpacks a pinned Chromium into /tmp
 * on first use. Everywhere else the local Chrome/Edge installation wins.
 */
async function packagedChromium(): Promise<BrowserTarget | null> {
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!serverless) return null;
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    return { executablePath: await chromium.executablePath(), args: [...chromium.args, ...BASE_ARGS] };
  } catch {
    return null;
  }
}

async function findBrowser(): Promise<BrowserTarget | null> {
  for (const candidate of BROWSER_CANDIDATES) {
    try {
      await fs.access(candidate);
      return { executablePath: candidate, args: BASE_ARGS };
    } catch {
      /* try next */
    }
  }
  return packagedChromium();
}

export async function pdfAvailable(): Promise<boolean> {
  // On Vercel the packaged browser is resolved (and extracted) at render time.
  if (process.env.VERCEL) return true;
  return (await findBrowser()) !== null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fontFace(family: string, file: string, weight: string, data: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${data}) format('truetype');font-display:swap;}`;
}

async function fontCss(): Promise<string> {
  const dir = path.join(process.cwd(), "src", "assets", "fonts");
  const [latin, latinBold, deva, devaBold] = await Promise.all([
    fs.readFile(path.join(dir, "NotoSans-Regular.ttf")).catch(() => null),
    fs.readFile(path.join(dir, "NotoSans-Bold.ttf")).catch(() => null),
    fs.readFile(path.join(dir, "NotoSansDevanagari-Regular.ttf")).catch(() => null),
    fs.readFile(path.join(dir, "NotoSansDevanagari-Bold.ttf")).catch(() => null),
  ]);
  const parts: string[] = [];
  if (latin) parts.push(fontFace("Noto Sans", "regular", "400", latin.toString("base64")));
  if (latinBold) parts.push(fontFace("Noto Sans", "bold", "700", latinBold.toString("base64")));
  if (deva) parts.push(fontFace("Noto Sans Devanagari", "regular", "400", deva.toString("base64")));
  if (devaBold) parts.push(fontFace("Noto Sans Devanagari", "bold", "700", devaBold.toString("base64")));
  return parts.join("");
}

function blockHtml(block: ReportBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${escapeHtml(block.text)}</p>`;
    case "list":
      return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    case "numberCards":
      return `<div class="numbers">${block.numbers
        .map(
          (number) => `<div class="number-card">
            <div class="number-value">${escapeHtml(number.value)}</div>
            <div class="number-label">${escapeHtml(number.label)} · ${escapeHtml(number.title)}</div>
            <p>${escapeHtml(number.detail)}</p>
            <p class="method">${escapeHtml(number.method)}</p>
          </div>`,
        )
        .join("")}</div>`;
    case "featureCards":
      return `<div class="features">${block.features
        .map(
          (feature) => `<div class="feature-card">
            <div class="feature-head"><strong>${escapeHtml(feature.name)}</strong>
            <span class="badge">${escapeHtml(feature.status)} · ${Math.round(feature.confidence * 100)}%</span></div>
            <p><strong>Observation:</strong> ${escapeHtml(feature.observation)}</p>
            <p><strong>Interpretation:</strong> ${escapeHtml(feature.interpretation)}</p>
            <p class="method">${escapeHtml(feature.uncertainty)}</p>
          </div>`,
        )
        .join("")}</div>`;
    case "planetTable":
      return `<table><thead><tr><th>Planet</th><th>Sign</th><th>Degree</th><th>Nakshatra</th><th>Pada</th><th>House</th><th>R</th></tr></thead><tbody>${block.rows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.sign)}</td><td>${row.degree.toFixed(2)}°</td><td>${escapeHtml(row.nakshatra)}</td><td>${row.pada}</td><td>${row.house ?? "—"}</td><td>${row.retrograde ? "R" : ""}</td></tr>`,
        )
        .join("")}</tbody></table><p class="method">${escapeHtml(block.note)}</p>`;
    case "dashaTimeline":
      return `<table><thead><tr><th>Lord</th><th>Start</th><th>End</th><th>Years</th></tr></thead><tbody>${block.periods
        .map(
          (period) =>
            `<tr><td>${escapeHtml(period.lord)}${period.isBalanceAtBirth ? " (balance)" : ""}</td><td>${escapeHtml(period.start)}</td><td>${escapeHtml(period.end)}</td><td>${period.years}</td></tr>`,
        )
        .join("")}</tbody></table><p class="method">${escapeHtml(block.note)}</p>`;
    case "callout":
      return `<div class="callout ${escapeHtml(block.tone)}"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.text)}</p></div>`;
    case "calculation":
      return `<div class="calculation"><strong>${escapeHtml(block.title)}</strong><ol>${block.steps
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join("")}</ol><p class="method">${escapeHtml(block.note)}</p></div>`;
    case "reflections":
      return `<ul class="reflections">${block.prompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("")}</ul>`;
    default:
      return "";
  }
}

function htmlDocument(doc: ReportDocument, fonts: string): string {
  const sections = doc.sections
    .map(
      (section, index) => `<section class="report-section" id="section-${index + 1}">
        <div class="section-kicker">${escapeHtml(section.kind.replace(/_/g, " "))}</div>
        <h2>${escapeHtml(section.title)}</h2>
        <p class="intro">${escapeHtml(section.intro)}</p>
        ${section.blocks.map(blockHtml).join("")}
      </section>`,
    )
    .join("");

  const toc = doc.sections
    .map(
      (section, index) =>
        `<li><span class="toc-title">${escapeHtml(section.title)}</span><span class="toc-dots"></span><span class="toc-page">${index + 3}</span></li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${escapeHtml(doc.language === "hi" ? "hi" : "en")}">
<head>
<meta charset="utf-8" />
<title>AIBABA Complete Life Reading</title>
<style>
${fonts}
*{box-sizing:border-box}
@page{size:A4;margin:20mm 16mm 22mm}
body{font-family:'Noto Sans','Noto Sans Devanagari',sans-serif;color:#242338;font-size:10.5pt;line-height:1.65;margin:0}
h1,h2,h3{font-family:'Noto Sans','Noto Sans Devanagari',sans-serif;color:#10152B;line-height:1.25}
.cover{height:247mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;background:linear-gradient(160deg,#10152B 0%,#22205A 58%,#6746C8 100%);color:#FAF7F0;margin:-20mm -16mm;padding:32mm 22mm 24mm}
.cover .brand{letter-spacing:.32em;font-size:9pt;text-transform:uppercase;color:#D6AE63}
.cover h1{font-size:38pt;color:#FAF7F0;margin:10mm 0 4mm;font-weight:700}
.cover .subtitle{font-size:14pt;color:#E9DFC8;margin:0}
.cover .rule{width:40mm;height:2px;background:#D6AE63;margin:12mm 0}
.cover .meta{font-size:9.5pt;color:#CFC6E8}
.cover .note{font-size:8.5pt;color:#B9B0D6;max-width:120mm}
.toc{page-break-after:always}
.toc h2{font-size:20pt;margin:0 0 8mm}
.toc ol{list-style:none;padding:0;margin:0}
.toc li{display:flex;align-items:baseline;gap:3mm;padding:3.4mm 0;border-bottom:1px solid #E7E1D4;font-size:11pt}
.toc-dots{flex:1;border-bottom:1px dotted #B9B0D6}
.toc-page{color:#6746C8;font-weight:700}
.report-section{page-break-inside:auto;margin-bottom:12mm}
.report-section h2{font-size:19pt;margin:0 0 3mm;padding-bottom:2mm;border-bottom:2px solid #D6AE63}
.section-kicker{color:#6746C8;text-transform:uppercase;letter-spacing:.18em;font-size:7.5pt;font-weight:700;margin-bottom:2mm}
.intro{font-size:11pt;color:#3E3B55}
p{margin:0 0 3mm}
ul,ol{margin:0 0 4mm;padding-left:5mm}
li{margin-bottom:1.6mm}
table{width:100%;border-collapse:collapse;margin:3mm 0 2mm;font-size:9pt}
th{background:#F1EDF9;color:#22205A;text-align:left;padding:2mm;border-bottom:1px solid #D8D0EA}
td{padding:2mm;border-bottom:1px solid #EEE9F6}
.method{font-size:8.2pt;color:#6B6785;font-style:italic}
.callout{border-left:3px solid #6746C8;background:#F7F4FC;padding:3.5mm 4mm;margin:4mm 0;border-radius:2mm}
.callout.caution{border-color:#B8862F;background:#FCF7EA}
.callout.traditional{border-color:#D6AE63;background:#FBF8F1}
.callout p{margin:1mm 0 0}
.calculation{background:#FBF9F4;border:1px solid #E8DFC9;border-radius:2mm;padding:4mm;margin:4mm 0}
.numbers{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:4mm 0}
.number-card{border:1px solid #E3DCF0;border-radius:2mm;padding:3.5mm;background:#FCFBFE}
.number-value{font-size:22pt;font-weight:700;color:#6746C8;line-height:1}
.number-label{font-size:7.8pt;text-transform:uppercase;letter-spacing:.08em;color:#6B6785;margin:1.5mm 0 2mm}
.number-card p{font-size:9pt;margin-bottom:1.5mm}
.features{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:4mm 0}
.feature-card{border:1px solid #E3DCF0;border-radius:2mm;padding:3.5mm;background:#FCFBFE;font-size:9pt}
.feature-head{display:flex;justify-content:space-between;gap:2mm;margin-bottom:2mm}
.feature-card p{margin-bottom:1.5mm}
.badge{font-size:7.5pt;background:#EFEAF9;color:#4B3797;border-radius:99px;padding:.6mm 2mm;white-space:nowrap}
.reflections li::marker{color:#D6AE63}
.disclosures{page-break-before:always}
.disclosure{border-top:1px solid #E3DCF0;padding:3mm 0}
.disclosure h3{font-size:10.5pt;margin:0 0 1.5mm;color:#22205A}
.disclosure p{font-size:9pt;color:#4C4966;margin:0}
.footer{font-size:8pt;color:#8C88A3}
</style>
</head>
<body>
<div class="cover">
  <div>
    <div class="brand">AIBABA · Complete Life Reading</div>
    <div class="rule"></div>
    <h1>${escapeHtml(doc.preferredName)}</h1>
    <p class="subtitle">Palmistry, numerology and Vedic astrology — clearly separated, carefully labelled.</p>
  </div>
  <div>
    <p class="meta">Prepared ${escapeHtml(new Date(doc.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}</p>
    <p class="note">This report combines traditional interpretation with validated calculations. It is a reflective reading, not a prediction, medical opinion or guarantee of outcomes.</p>
  </div>
</div>

<div class="toc">
  <h2>Contents</h2>
  <ol>${toc}</ol>
  <div style="margin-top:14mm">
    <h3 style="font-size:12pt">Methods used</h3>
    ${doc.methods
      .map(
        (method) =>
          `<p style="margin-bottom:2mm"><strong>${escapeHtml(method.module)}</strong> — ${escapeHtml(method.status)}<br/><span class="method">${escapeHtml(method.method)}. ${escapeHtml(method.note)}</span></p>`,
      )
      .join("")}
  </div>
</div>

${sections}

<div class="disclosures">
  <h2 style="font-size:19pt;border-bottom:2px solid #D6AE63;padding-bottom:2mm">Important disclosures</h2>
  <div class="disclosure"><h3>Traditional interpretation</h3><p>${escapeHtml(doc.disclosures.traditional)}</p></div>
  <div class="disclosure"><h3>AI-assisted language</h3><p>${escapeHtml(doc.disclosures.ai)}</p></div>
  <div class="disclosure"><h3>Uncertainty</h3><p>${escapeHtml(doc.disclosures.uncertainty)}</p></div>
  <div class="disclosure"><h3>Not predictive</h3><p>${escapeHtml(doc.disclosures.notPredictive)}</p></div>
</div>
</body>
</html>`;
}

export async function renderReportPdf(document: ReportDocument): Promise<Buffer> {
  const target = await findBrowser();
  if (!target) {
    throw new Error("PDF_RENDERER_UNAVAILABLE");
  }
  const fonts = await fontCss();
  const html = htmlDocument(document, fonts);
  const browser = await puppeteer.launch({
    executablePath: target.executablePath,
    headless: true,
    args: target.args,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div class="footer" style="width:100%;text-align:right;padding:0 16mm;color:#8C88A3;font-size:8pt">AIBABA · Complete Life Reading</div>`,
      footerTemplate: `<div class="footer" style="width:100%;display:flex;justify-content:space-between;padding:0 16mm;color:#8C88A3;font-size:8pt"><span>Traditional reflection, not prediction</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      margin: { top: "20mm", right: "16mm", bottom: "22mm", left: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
