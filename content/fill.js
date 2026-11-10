// Injected into the job page (every frame) when you press "Fill this page".
// It finds the visible, empty fields it recognizes and fills them.
// Fields that already have a value are never changed.
(function () {
  const SKIP_INPUT_TYPES = [
    "hidden", "submit", "button", "reset", "image", "file", "checkbox", "radio",
    "password", "search", "range", "color", "date", "datetime-local", "time", "month", "week"
  ];

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
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

    const display = normalize(
      label || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.id || "(unnamed field)"
    );
    return { display: display, hint: normalize(hintParts.join(" ")) };
  }

  function isFillable(el) {
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === "INPUT" && SKIP_INPUT_TYPES.includes((el.type || "text").toLowerCase())) return false;
    // Elements that are hidden with display:none have no layout boxes.
    return el.getClientRects().length > 0;
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

  function setSelect(el, value) {
    const wanted = String(value).trim().toLowerCase();
    const options = Array.from(el.options);
    const match =
      options.find(o => o.text.trim().toLowerCase() === wanted || o.value.trim().toLowerCase() === wanted) ||
      options.find(o => o.text.trim().toLowerCase().includes(wanted));
    if (!match || match.value === "") return false;
    el.value = match.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // Attaches the saved resume to a file upload box on this page.
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

  function fillPage(profile, resume) {
    const rules = window.JOB_FIELD_RULES || [];
    const result = { filled: [], kept: [], missing: [] };
    const fields = Array.from(document.querySelectorAll("input, textarea, select")).filter(isFillable);

    for (const el of fields) {
      const described = describeField(el);
      const rule = rules.find(r => r.patterns.some(p => p.test(described.hint)));

      if (!rule) {
        // Not something we know how to fill, such as essay questions. Show it so you can handle it.
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
