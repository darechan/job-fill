# Job Autofill

A personal Chrome extension that fills job application forms from a saved
profile, with one click. Everything stays on your own computer — there's no
server, no account, and no hosting involved.

## What it does

- You fill in your details once in the popup (name, email, links, work
  history, address, and so on) and save them.
- You pick a resume file in the popup.
- On any job application page, click **Fill this page**. The extension scans
  the visible form fields, matches them to your saved details, and fills
  them in.
- Fields that already have a value are **never** overwritten.
- Anything it couldn't recognize (like essay questions) is listed so you can
  fill it in yourself.

## Installing it (no Chrome Web Store needed)

1. Download or clone this repository to your computer.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `chrome-extension` project folder (the one containing
   `manifest.json`).
6. The extension icon will appear in your toolbar. Pin it for easy access
   (puzzle-piece icon → pin).

That's it — no build step, no npm install, nothing to compile.

## Using it

1. Click the extension icon.
2. Fill in your profile fields and click **Save profile**.
3. Upload your resume under the **Resume** section (saved automatically).
4. Open a job application page.
5. Click the extension icon, then **Fill this page**.
6. Review the filled form, answer any listed/missing fields yourself, then
   submit the application manually — the extension never submits for you.

## Updating after you change the code

If you edit any file after installing:

1. Go to `chrome://extensions`.
2. Click the refresh icon on the Job Autofill card.
3. Reload the job application tab before clicking "Fill this page" again.

## Project structure

```
chrome-extension/
├── manifest.json        Extension metadata and permissions
├── popup/
│   ├── popup.html        Popup window layout
│   ├── popup.css         Popup styling
│   └── popup.js          Profile/resume storage, triggers the fill
├── content/
│   └── fill.js            Injected into the page; finds and fills fields
├── data/
│   └── fieldRules.js      Label-matching rules per profile field
└── README.md
```

## Known limitations (MVP)

- Essay/free-text questions are left for you to answer.
- Some sites with heavily custom widgets (certain dropdowns, multi-step
  wizards) may need extra handling later.
- One resume is stored at a time; switching jobs with different resumes
  means re-uploading each time.

## Privacy

Your profile and resume are stored only in Chrome's local extension storage
on your own machine (`chrome.storage.local`). Nothing is sent anywhere.
