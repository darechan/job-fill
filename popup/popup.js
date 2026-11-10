// Runs inside the popup window: loads/saves your profile and resume,
// and tells the active tab's content script to fill the page.
const PROFILE_FIELDS = [
  "firstName", "lastName", "fullName", "email", "phone", "linkedin", "github",
  "portfolio", "currentCompany", "currentTitle", "school", "degree",
  "yearsExperience", "salary", "addressLine1", "city", "state", "zip", "country",
  "workAuthorized", "needsSponsorship", "over18", "driversLicense", "backgroundCheckConsent",
  "genderIdentity", "raceEthnicity", "disabilityStatus", "veteranStatus"
];

const form = document.getElementById("profileForm");
const saveStatus = document.getElementById("saveStatus");
const fillBtn = document.getElementById("fillBtn");
const fillStatus = document.getElementById("fillStatus");
const resumeInput = document.getElementById("resumeInput");
const resumeName = document.getElementById("resumeName");

function loadProfile() {
  chrome.storage.local.get(["profile", "resume"], (data) => {
    const profile = data.profile || {};
    for (const field of PROFILE_FIELDS) {
      const el = form.elements[field];
      if (el) el.value = profile[field] || "";
    }
    if (data.resume) resumeName.textContent = "Saved: " + data.resume.name;
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    profile[field] = form.elements[field].value.trim();
  }
  chrome.storage.local.set({ profile }, () => {
    saveStatus.textContent = "Saved.";
    setTimeout(() => (saveStatus.textContent = ""), 1500);
  });
});

resumeInput.addEventListener("change", () => {
  const file = resumeInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    // Store the resume as base64 so it can rebuild a File object on any page later.
    const base64 = reader.result.split(",")[1];
    const resume = { name: file.name, type: file.type, data: base64 };
    chrome.storage.local.set({ resume }, () => {
      resumeName.textContent = "Saved: " + file.name;
    });
  };
  reader.readAsDataURL(file);
});

fillBtn.addEventListener("click", async () => {
  fillStatus.textContent = "Filling...";
  const { profile, resume } = await chrome.storage.local.get(["profile", "resume"]);

  if (!profile) {
    fillStatus.textContent = "Save your profile first.";
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["data/fieldRules.js", "content/fill.js"]
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (profile, resume) => window.__jobAutofillRun(profile, resume),
      args: [profile, resume || null]
    });

    const totals = { filled: 0, kept: 0, missing: [] };
    for (const frame of results) {
      const r = frame.result;
      if (!r) continue;
      totals.filled += r.filled.length;
      totals.kept += r.kept.length;
      totals.missing.push(...r.missing);
    }

    let message = "Filled " + totals.filled + " field(s).";
    if (totals.kept) message += " Left " + totals.kept + " already-filled field(s) untouched.";
    if (totals.missing.length) {
      message += "\nCouldn't fill: " + totals.missing.slice(0, 6).join(", ");
      if (totals.missing.length > 6) message += ", +" + (totals.missing.length - 6) + " more";
    }
    fillStatus.textContent = message;
  } catch (err) {
    fillStatus.textContent = "Couldn't run on this page: " + err.message;
  }
});

loadProfile();
