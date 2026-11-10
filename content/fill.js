// Injected into the job page (every frame) when you press "Fill this page".
// Finds visible, empty fields it recognizes and fills them. Fields that
// already have a value are never changed.
(function () {
  const SKIP_INPUT_TYPES = [
    "hidden", "submit", "button", "reset", "image", "file", "checkbox", "radio",
    "password", "search", "range", "color", "date", "datetime-local", "time", "week"
  ];
  // Checkbox/radio are excluded from the generic pass above, but handled on
  // their own below (work-history checkboxes, Yes/No radio questions), since
  // those need different, more careful logic than plain text fields.

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Works out the label a person would read for a field, plus a hint string
  // built from every attribute that might describe it.
  function describeField(el) {
    const hintParts = [];
    let label = "";

    if (el.id) {
      const byFor = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (byFor) label = byFor.textContent;
    }
    const wrapper = el.closest("label");
    if (!label && wrapper) label = wrapper.textContent;

    for (const attr of ["aria-label", "placeholder", "name", "id", "autocomplete", "data-automation-id", "data-testid"]) {
      const value = el.getAttribute(attr);
      if (value) hintParts.push(value);
    }

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const node = document.getElementById(id);
        if (node) hintParts.push(node.textContent);
      }
    }
    if (label) hintParts.push(label);
    if (el.textContent && (el.tagName === "BUTTON" || el.getAttribute("role") === "button")) {
      hintParts.push(el.textContent);
    }

    const display = normalize(
      label || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.id || "(unnamed field)"
    );
    return { display: display, hint: normalize(hintParts.join(" ")) };
  }

  function isVisible(el) {
    return el.getClientRects().length > 0;
  }

  function isFillable(el) {
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === "INPUT" && SKIP_INPUT_TYPES.includes((el.type || "text").toLowerCase())) return false;
    return isVisible(el);
  }

  function hasValue(el) {
    if (el.tagName === "SELECT") return el.selectedIndex > 0 && el.value !== "";
    return el.value.trim() !== "";
  }

  // Setting .value directly is ignored by React, Angular and Vue.
  // Calling the native setter and then firing events makes the site notice the change.
  function setText(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    return true;
  }

  function setChecked(el, checked) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked").set;
    setter.call(el, checked);
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // Phrasings that different sites use for the same answer. If your saved
  // profile value matches one of these groups, any phrasing in that group is
  // accepted, so you don't have to guess each site's exact wording.
  const SELECT_SYNONYM_GROUPS = [
    [/decline/i, /prefer not/i, /opt.?out/i, /not.?wish/i, /not.?specified/i, /undisclosed/i, /do not wish/i],
    [/^yes$/i, /\bi agree\b/i, /^agree$/i],
    [/^no$/i, /\bi do not agree\b/i, /^disagree$/i],
    [/bachelor/i, /\bb\.?s\.?\b/i, /\bb\.?a\.?\b/i, /undergraduate/i],
    [/master/i, /\bm\.?s\.?\b/i, /\bm\.?a\.?\b/i, /\bmba\b/i],
    [/doctor/i, /\bph\.?d\.?\b/i],
    [/associate/i, /\ba\.?a\.?\b/i, /\ba\.?s\.?\b/i],
    [/high school/i, /\bged\b/i, /secondary/i]
  ];

  function synonymMatch(wanted, optionText) {
    for (const group of SELECT_SYNONYM_GROUPS) {
      const wantedIsInGroup = group.some(p => p.test(wanted));
      const optionIsInGroup = group.some(p => p.test(optionText));
      if (wantedIsInGroup && optionIsInGroup) return true;
    }
    return false;
  }

  function bestTextMatch(wanted, candidates, getText) {
    return (
      candidates.find(c => getText(c).trim().toLowerCase() === wanted) ||
      candidates.find(c => getText(c).trim().toLowerCase().includes(wanted)) ||
      candidates.find(c => synonymMatch(wanted, getText(c).trim().toLowerCase()))
    );
  }

  function setSelect(el, value) {
    const wanted = String(value).trim().toLowerCase();
    const match = bestTextMatch(wanted, Array.from(el.options), o => o.text) ||
      Array.from(el.options).find(o => o.value.trim().toLowerCase() === wanted);
    if (!match || match.value === "") return false;
    el.value = match.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function attachResume(resume) {
    if (!resume) return null;
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (inputs.length === 0) return null;

    const looksLikeResume = el => /resume|\bcv\b/i.test(describeField(el).hint);
    const target = inputs.find(looksLikeResume) || (inputs.length === 1 ? inputs[0] : null);
    if (!target) return { status: "missing", label: "Resume upload (couldn't tell which box)" };

    if (target.files && target.files.length > 0) return { status: "kept", label: "Resume (already attached)" };

    const binary = atob(resume.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const file = new File([bytes], resume.name, { type: resume.type || "application/pdf" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    target.files = transfer.files;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return { status: "filled", label: "Resume" };
  }

  // --- Repeating sections: Work Experience and Education ---
  // These sites render one block per entry, with an "Add Another" button to
  // create more. We detect blocks by a distinctive "anchor" field (Job Title
  // for work, School for education), slice the page's fields into blocks
  // between consecutive anchors, click "Add Another" until there are enough
  // blocks for your saved entries, then fill each block in order.

  function allFormElements() {
    return Array.from(document.querySelectorAll("input, textarea, select")).filter(isVisible);
  }

  function findAnchors(matchHint) {
    return allFormElements().filter(el => matchHint(describeField(el).hint));
  }

  function sliceIntoBlocks(anchors) {
    const all = allFormElements();
    const indices = anchors.map(a => all.indexOf(a)).filter(i => i !== -1).sort((a, b) => a - b);
    const blocks = [];
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = i + 1 < indices.length ? indices[i + 1] : all.length;
      blocks.push(all.slice(start, end));
    }
    return blocks;
  }

  function findAddButton(afterEl) {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(isVisible);
    const texted = candidates.filter(c => /add\s+(another|more|experience|education)/i.test(normalize(c.textContent)));
    if (texted.length === 0) return null;
    if (!afterEl) return texted[texted.length - 1];
    const after = texted.filter(c => afterEl.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
    return after[0] || texted[texted.length - 1];
  }

  function matchesAny(hint, patterns) {
    return patterns.some(p => p.test(hint));
  }

  async function fillRepeatingSection(entries, opts) {
    const result = { filled: [], kept: [], missing: [] };
    if (!entries || entries.length === 0) return result;

    let anchors = findAnchors(opts.anchorMatch);
    let guard = 0;
    while (anchors.length < entries.length && guard < entries.length + 3) {
      const btn = findAddButton(anchors[anchors.length - 1]);
      if (!btn) break;
      btn.click();
      await wait(350);
      anchors = findAnchors(opts.anchorMatch);
      guard++;
    }

    const blocks = sliceIntoBlocks(anchors);
    entries.forEach((entry, i) => {
      const block = blocks[i];
      if (!block) {
        result.missing.push(opts.label + " " + (i + 1) + " (couldn't create a block for it on this page)");
        return;
      }
      for (const field of opts.fields) {
        const el = block.find(e => matchesAny(describeField(e).hint, field.match));
        if (!el) continue;
        el.dataset.jobAutofillHandled = "1";
        const value = entry[field.key];

        if (el.type === "checkbox") {
          if (typeof value === "boolean") {
            setChecked(el, value);
            result.filled.push(opts.label + " " + (i + 1) + ": " + field.label);
          }
          continue;
        }
        if (!value) continue;
        if (hasValue(el)) {
          result.kept.push(opts.label + " " + (i + 1) + ": " + field.label);
          continue;
        }
        const ok = el.tagName === "SELECT" ? setSelect(el, value) : setText(el, value);
        (ok ? result.filled : result.missing).push(opts.label + " " + (i + 1) + ": " + field.label);
      }
    });

    return result;
  }

  function workExperienceOptions() {
    return {
      label: "Work experience",
      anchorMatch: hint => /\bjob\s*title\b/i.test(hint) && !/current/i.test(hint),
      fields: [
        { key: "jobTitle", label: "Job title", match: [/\bjob\s*title\b/i] },
        { key: "company", label: "Company", match: [/\bcompany\b/i] },
        { key: "location", label: "Location", match: [/\blocation\b/i] },
        { key: "current", label: "Currently work here", match: [/currently work here/i, /i currently work/i] },
        { key: "startDate", label: "Start date", match: [/\bfrom\b/i, /start date/i] },
        { key: "endDate", label: "End date", match: [/\bto\b/i, /end date/i] },
        { key: "description", label: "Description", match: [/description/i, /responsibilit/i, /summary/i] }
      ]
    };
  }

  function educationOptions() {
    return {
      label: "Education",
      anchorMatch: hint => /school|university/i.test(hint),
      fields: [
        { key: "school", label: "School", match: [/school|university/i] },
        { key: "degree", label: "Degree", match: [/\bdegree\b/i] },
        { key: "fieldOfStudy", label: "Field of study", match: [/field of study/i, /\bmajor\b/i] },
        { key: "gpa", label: "GPA", match: [/\bgpa\b/i, /overall result/i] },
        { key: "startDate", label: "Start year", match: [/\bfrom\b/i] },
        { key: "endDate", label: "End year", match: [/\bto\b/i] }
      ]
    };
  }

  // --- Yes/No screening questions rendered as radio buttons ---

  function groupRadios() {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]')).filter(isVisible).filter(r => !r.disabled);
    const groups = new Map();
    for (const r of radios) {
      if (!r.name) continue;
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    }
    return Array.from(groups.values());
  }

  function describeRadioGroup(radios) {
    const fieldset = radios[0].closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      if (legend) return normalize(legend.textContent);
    }
    const container = radios[0].closest("div, li, section") || radios[0].parentElement;
    if (!container) return "";
    let text = normalize(container.textContent);
    for (const r of radios) text = text.replace(normalize(describeField(r).display), "");
    return normalize(text);
  }

  function fillRadioGroups(rules, profile) {
    const result = { filled: [], kept: [], missing: [] };
    for (const radios of groupRadios()) {
      const already = radios.find(r => r.checked);
      const question = describeRadioGroup(radios);
      const rule = rules.find(r => r.patterns.some(p => p.test(question)));

      if (!rule) {
        result.missing.push(question || "(unlabeled question)");
        continue;
      }
      if (already) { result.kept.push(rule.label); continue; }
      const value = profile[rule.key];
      if (!value) { result.missing.push(rule.label); continue; }
      const wanted = String(value).trim().toLowerCase();
      const target = bestTextMatch(wanted, radios, r => describeField(r).display);
      (target ? (setChecked(target, true), result.filled) : result.missing).push(rule.label);
    }
    return result;
  }

  // --- Yes/No / multiple-choice questions rendered as custom "Select One"
  // dropdown widgets (common on Workday and similar sites), not a plain
  // <select>. This is best-effort: it opens the dropdown, looks for an
  // option matching your saved answer among newly-visible items, and clicks
  // it. If a site's widget doesn't open this way, the question is listed as
  // missing instead of guessing wrong.

  function findCustomDropdownTriggers() {
    const candidates = Array.from(document.querySelectorAll(
      'button, [role="button"], [role="combobox"], [aria-haspopup="listbox"]'
    )).filter(isVisible);
    return candidates.filter(el => /^(-+\s*)?select(\s*(one|\.\.\.|-+))?$|^choose\.*$/i.test(normalize(el.textContent)));
  }

  function describeDropdownQuestion(trigger) {
    const described = describeField(trigger);
    if (described.hint) return described.hint;
    const container = trigger.closest("div, li, section") || trigger.parentElement;
    return container ? normalize(container.textContent).replace(/select one/i, "") : "";
  }

  async function pickCustomDropdownOption(trigger, wanted) {
    trigger.click();
    await wait(250);
    const options = Array.from(document.querySelectorAll(
      '[role="option"], [role="listbox"] li, [role="listbox"] div, ul[role="listbox"] > *'
    )).filter(isVisible);
    const match = bestTextMatch(wanted, options, o => o.textContent);
    if (!match) {
      document.body.click();
      return false;
    }
    match.click();
    await wait(100);
    return true;
  }

  async function fillCustomDropdowns(rules, profile) {
    const result = { filled: [], kept: [], missing: [] };
    for (const trigger of findCustomDropdownTriggers()) {
      const question = describeDropdownQuestion(trigger);
      const rule = rules.find(r => r.patterns.some(p => p.test(question)));
      if (!rule) { result.missing.push(question || "(unlabeled dropdown)"); continue; }
      const value = profile[rule.key];
      if (!value) { result.missing.push(rule.label); continue; }
      const ok = await pickCustomDropdownOption(trigger, String(value).trim().toLowerCase());
      (ok ? result.filled : result.missing).push(rule.label);
    }
    return result;
  }

  function merge(target, addition) {
    target.filled.push(...addition.filled);
    target.kept.push(...addition.kept);
    target.missing.push(...addition.missing);
  }

  async function fillPage(profile, resume, workHistory, education) {
    const rules = window.JOB_FIELD_RULES || [];
    const result = { filled: [], kept: [], missing: [] };

    // 1. Repeating sections first, so their fields are marked "handled" and
    // skipped by the generic pass below.
    merge(result, await fillRepeatingSection(workHistory || [], workExperienceOptions()));
    merge(result, await fillRepeatingSection(education || [], educationOptions()));

    // 2. Yes/No questions rendered as radio buttons or custom dropdowns.
    merge(result, fillRadioGroups(rules, profile));
    merge(result, await fillCustomDropdowns(rules, profile));

    // 3. Every other plain input/textarea/select on the page.
    const fields = allFormElements().filter(isFillable).filter(el => !el.dataset.jobAutofillHandled);

    for (const el of fields) {
      const described = describeField(el);
      const rule = rules.find(r => r.patterns.some(p => p.test(described.hint)));

      if (!rule) {
        result.missing.push(described.display);
        continue;
      }
      if (hasValue(el)) {
        result.kept.push(rule.label);
        continue;
      }
      const value = profile[rule.key];
      if (!value) {
        result.missing.push(rule.label);
        continue;
      }
      const ok = el.tagName === "SELECT" ? setSelect(el, value) : setText(el, value);
      (ok ? result.filled : result.missing).push(rule.label);
    }

    const resumeResult = attachResume(resume);
    if (resumeResult) result[resumeResult.status].push(resumeResult.label);

    return result;
  }

  window.__jobAutofillRun = fillPage;
})();
