// Runs inside the popup: turns your saved resume (PDF or DOCX) into plain
// text, then guesses work experience and education entries from it using
// pattern-matching. Entirely local — nothing leaves your browser. Results
// are a starting draft: review and fix them before saving, since resume
// layouts vary too much for this to be perfect every time.

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function extractPdfText(arrayBuffer) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdf.worker.min.js");
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Keep each text item on its own line when pdf.js reports a big vertical
    // jump from the previous item — a rough stand-in for "new line" so
    // section headers and bullet points stay separate.
    let line = "";
    let lastY = null;
    const lines = [];
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = "";
      }
      line += item.str + " ";
      lastY = y;
    }
    lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

async function extractDocxText(arrayBuffer) {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractResumeText(resume) {
  const buffer = base64ToArrayBuffer(resume.data);
  const name = (resume.name || "").toLowerCase();
  if (name.endsWith(".pdf") || (resume.type || "").includes("pdf")) {
    return extractPdfText(buffer);
  }
  if (name.endsWith(".docx")) {
    return extractDocxText(buffer);
  }
  throw new Error("Can only scan PDF or DOCX resumes (not .doc, .txt, or others).");
}

// --- Heuristic parsing of the extracted text ---

const SECTION_HEADERS = {
  experience: /^(work\s+|professional\s+)?experience$|^employment\s+history$/i,
  education: /^education$/i,
  stop: /^(skills|projects|certifications|summary|objective|references|awards|publications|interests)$/i
};

const DATE_RANGE = /((?:[A-Z][a-z]{2,8}\.?\s+\d{4})|(?:\d{1,2}\/\d{4})|\d{4})\s*(?:-|–|—|to)\s*((?:[A-Z][a-z]{2,8}\.?\s+\d{4})|(?:\d{1,2}\/\d{4})|\d{4}|present|current)/i;

function splitIntoSections(lines) {
  const sections = {};
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const key = Object.keys(SECTION_HEADERS).find(k => SECTION_HEADERS[k].test(line));
    if (key) {
      current = key === "stop" ? null : key;
      if (current) sections[current] = sections[current] || [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

function splitTitleLine(line) {
  // Common resume formats: "Title, Company", "Title | Company | Location",
  // "Title — Company", "Title at Company".
  const parts = line.split(/\s*[|,–—-]\s*| at /i).map(p => p.trim()).filter(Boolean);
  return {
    jobTitle: parts[0] || "",
    company: parts[1] || "",
    location: parts[2] || ""
  };
}

function parseWorkSection(lines) {
  // Resumes format this two different ways: "Title, Company — dates" all on
  // one line, or a title/company line followed by a separate date line. We
  // find every date-range line first (an "anchor"), then work out each
  // entry's title from either that same line or the one right before it,
  // and its description from everything between one anchor and the next.
  const anchors = [];
  lines.forEach((line, idx) => {
    const m = line.match(DATE_RANGE);
    if (m) anchors.push({ idx, match: m, before: line.slice(0, m.index).trim() });
  });
  if (anchors.length === 0) return [];

  const entries = [];
  anchors.forEach((anchor, i) => {
    let titleLine = anchor.before;
    if (!titleLine) {
      const prevAnchorIdx = i > 0 ? anchors[i - 1].idx : -1;
      if (anchor.idx - 1 > prevAnchorIdx) titleLine = lines[anchor.idx - 1];
    }
    const parsed = splitTitleLine(titleLine || "");
    const isCurrent = /present|current/i.test(anchor.match[2]);

    const nextAnchor = anchors[i + 1];
    const descEnd = nextAnchor ? (nextAnchor.before ? nextAnchor.idx : nextAnchor.idx - 1) : lines.length;
    const description = lines.slice(anchor.idx + 1, Math.max(descEnd, anchor.idx + 1)).join(" ").trim();

    entries.push({
      jobTitle: parsed.jobTitle,
      company: parsed.company,
      location: parsed.location,
      current: isCurrent,
      startDate: anchor.match[1],
      endDate: isCurrent ? "" : anchor.match[2],
      description
    });
  });
  return entries;
}

const DEGREE_WORD = /bachelor|master|associate|ph\.?d|doctorate|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|mba/i;

const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

function parseEducationSection(lines) {
  // Same anchor idea as work experience: find every line mentioning a year,
  // then everything since the previous anchor (school name, degree, field,
  // GPA — in whatever order/lines the resume uses) belongs to that entry.
  const anchors = [];
  lines.forEach((line, idx) => {
    if (YEAR_PATTERN.test(line)) anchors.push({ idx, line });
  });

  if (anchors.length === 0) {
    // No years at all: fall back to one entry per degree-sounding line.
    return lines.filter(l => DEGREE_WORD.test(l)).map(l => {
      const parts = l.split(/\s*[,–—-]\s*|\sin\s/i).map(p => p.trim()).filter(Boolean);
      const degree = parts.find(p => DEGREE_WORD.test(p)) || parts[0] || "";
      return { school: "", degree, fieldOfStudy: parts.find(p => p && p !== degree) || "", gpa: "", startDate: "", endDate: "" };
    });
  }

  const entries = [];
  anchors.forEach((anchor, i) => {
    const prevIdx = i > 0 ? anchors[i - 1].idx : -1;
    const blockLines = lines.slice(prevIdx + 1, anchor.idx + 1);
    let school = "", degree = "", fieldOfStudy = "", gpa = "";

    for (const line of blockLines) {
      const gpaMatch = line.match(/gpa[:\s]*([\d.]+)/i);
      if (gpaMatch) gpa = gpaMatch[1];

      if (DEGREE_WORD.test(line)) {
        const withoutYear = line.replace(YEAR_PATTERN, "").trim();
        const parts = withoutYear.split(/\s*[,–—-]\s*|\sin\s/i).map(p => p.trim()).filter(Boolean);
        degree = degree || parts.find(p => DEGREE_WORD.test(p)) || parts[0] || "";
        fieldOfStudy = fieldOfStudy || parts.find(p => p && p !== degree) || "";
      } else if (!school) {
        const withoutYear = line.replace(YEAR_PATTERN, "").trim();
        if (withoutYear) school = withoutYear.split(/\s*[,–—-]\s*/)[0];
      }
    }

    const years = anchor.line.match(/\b(19|20)\d{2}\b/g) || [];
    entries.push({ school, degree, fieldOfStudy, gpa, startDate: years[0] || "", endDate: years[1] || "" });
  });
  return entries;
}

// Heuristic fallback: if no clear "Education"/"Experience" headers were
// found (some resumes skip them, or the extracted text lost structure),
// scan the whole document for date-range lines as a best effort.
function parseWholeDocumentAsExperience(lines) {
  return parseWorkSection(lines);
}

async function scanResumeForHistory(resume) {
  const text = await extractResumeText(resume);
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const sections = splitIntoSections(lines);

  const workHistory = sections.experience
    ? parseWorkSection(sections.experience)
    : parseWholeDocumentAsExperience(lines).slice(0, 5);
  const education = sections.education ? parseEducationSection(sections.education) : [];

  return { workHistory, education };
}

window.__scanResumeForHistory = scanResumeForHistory;
