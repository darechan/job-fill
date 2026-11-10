// Runs inside the popup window: loads/saves your profile, work history,
// education, and resume; tells the active tab's content script to fill the page.
const PROFILE_FIELDS = [
  "firstName", "lastName", "fullName", "email", "phone", "linkedin", "github",
  "portfolio", "currentCompany", "currentTitle", "school", "degree",
  "yearsExperience", "salary", "addressLine1", "city", "state", "zip", "country",
  "workAuthorized", "needsSponsorship", "citizenshipStatus", "over18", "driversLicense",
  "backgroundCheckConsent", "nonCompete", "conflictOfInterest", "phoneType",
  "genderIdentity", "raceEthnicity", "disabilityStatus", "veteranStatus"
];

const WORK_FIELDS = [
  { key: "jobTitle", label: "Job title", type: "text" },
  { key: "company", label: "Company", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "current", label: "I currently work here", type: "checkbox" },
  { key: "startDate", label: "Start", type: "text" },
  { key: "endDate", label: "End", type: "text" },
  { key: "description", label: "Description", type: "textarea" }
];

const EDU_FIELDS = [
  { key: "school", label: "School", type: "text" },
  { key: "degree", label: "Degree", type: "text" },
  { key: "fieldOfStudy", label: "Field of study", type: "text" },
  { key: "gpa", label: "GPA", type: "text" },
  { key: "startDate", label: "Start year", type: "text" },
  { key: "endDate", label: "End year", type: "text" }
];

const form = document.getElementById("profileForm");
const saveStatus = document.getElementById("saveStatus");
const saveBtn = document.getElementById("saveBtn");
const fillBtn = document.getElementById("fillBtn");
const fillStatus = document.getElementById("fillStatus");
const resumeInput = document.getElementById("resumeInput");
const resumeName = document.getElementById("resumeName");
const workList = document.getElementById("workList");
const eduList = document.getElementById("eduList");

function buildEntryCard(fields, values) {
  const card = document.createElement("div");
  card.className = "entryCard";

  for (const f of fields) {
    const label = document.createElement("label");
    label.textContent = f.label + " ";
    let input;
    if (f.type === "textarea") {
      input = document.createElement("textarea");
    } else if (f.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    input.dataset.key = f.key;
    if (f.type === "checkbox") input.checked = !!values[f.key];
    else input.value = values[f.key] || "";
    label.appendChild(input);
    card.appendChild(label);
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "removeBtn";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => card.remove());
  card.appendChild(removeBtn);

  return card;
}

function readEntryCards(container, fields) {
  return Array.from(container.children).map(card => {
    const entry = {};
    for (const f of fields) {
      const input = card.querySelector('[data-key="' + f.key + '"]');
      if (!input) continue;
      entry[f.key] = f.type === "checkbox" ? input.checked : input.value.trim();
    }
    return entry;
  });
}

document.getElementById("addWork").addEventListener("click", () => {
  workList.appendChild(buildEntryCard(WORK_FIELDS, {}));
});
document.getElementById("addEdu").addEventListener("click", () => {
  eduList.appendChild(buildEntryCard(EDU_FIELDS, {}));
});

function loadProfile() {
  chrome.storage.local.get(["profile", "resume", "workHistory", "education"], (data) => {
    const profile = data.profile || {};
    for (const field of PROFILE_FIELDS) {
      const el = form.querySelector('[name="' + field + '"]');
      if (el) el.value = profile[field] || "";
    }
    if (data.resume) resumeName.textContent = "Saved: " + data.resume.name;

    workList.innerHTML = "";
    (data.workHistory || []).forEach(entry => workList.appendChild(buildEntryCard(WORK_FIELDS, entry)));

    eduList.innerHTML = "";
    (data.education || []).forEach(entry => eduList.appendChild(buildEntryCard(EDU_FIELDS, entry)));
  });
}

saveBtn.addEventListener("click", () => {
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    const el = form.querySelector('[name="' + field + '"]');
    if (el) profile[field] = el.value.trim();
  }
  const workHistory = readEntryCards(workList, WORK_FIELDS);
  const education = readEntryCards(eduList, EDU_FIELDS);

  chrome.storage.local.set({ profile, workHistory, education }, () => {
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
  const { profile, resume, workHistory, education } =
    await chrome.storage.local.get(["profile", "resume", "workHistory", "education"]);

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
      func: (profile, resume, workHistory, education) =>
        window.__jobAutofillRun(profile, resume, workHistory, education),
      args: [profile, resume || null, workHistory || [], education || []]
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
