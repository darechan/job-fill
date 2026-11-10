// Maps each profile value to the labels and hints that identify it on a form.
// A field's label, name, id, placeholder, and autocomplete attribute are all
// checked against these patterns. The first matching rule wins, so keep
// specific rules above general ones.
(function () {
  window.JOB_FIELD_RULES = [
    { key: "firstName", label: "First name", patterns: [/first.?name/i, /given.?name/i, /\bfname\b/i] },
    { key: "lastName", label: "Last name", patterns: [/last.?name/i, /family.?name/i, /surname/i, /\blname\b/i] },
    { key: "fullName", label: "Full name", patterns: [/full.?name/i, /legal.?name/i] },
    { key: "email", label: "Email", patterns: [/e-?mail/i] },
    { key: "phone", label: "Phone", patterns: [/phone/i, /mobile/i, /\btel\b/i, /\bcell\b/i] },
    { key: "linkedin", label: "LinkedIn", patterns: [/linkedin/i] },
    { key: "github", label: "GitHub", patterns: [/github/i] },
    { key: "portfolio", label: "Portfolio / website", patterns: [/portfolio/i, /website/i, /personal.?site/i] },
    { key: "currentCompany", label: "Current company", patterns: [/current.?(company|employer)/i] },
    { key: "currentTitle", label: "Current job title", patterns: [/current.?(job.?)?title/i] },
    { key: "school", label: "School", patterns: [/school/i, /university/i, /college/i] },
    { key: "degree", label: "Degree", patterns: [/degree/i] },
    { key: "yearsExperience", label: "Years of experience", patterns: [/years.?(of.?)?experience/i] },
    { key: "salary", label: "Salary expectation", patterns: [/salary/i, /compensation/i] },
    { key: "addressLine1", label: "Street address", patterns: [/address.?(line)?.?1/i, /street/i, /\baddress\b/i] },
    { key: "city", label: "City", patterns: [/\bcity\b/i, /\btown\b/i, /address-level2/i] },
    { key: "state", label: "State / province", patterns: [/\bstate\b/i, /province/i, /address-level1/i] },
    { key: "zip", label: "Postal / ZIP code", patterns: [/\bzip\b/i, /postal/i, /postcode/i] },
    { key: "country", label: "Country", patterns: [/country/i] }
  ];
})();
