// Maps each profile value to the labels and hints that identify it on a form.
// A field's label, name, id, placeholder, and autocomplete attribute are all
// checked against these patterns. The first matching rule wins, so keep
// specific rules above general ones.
(function () {
  window.JOB_FIELD_RULES = [
    { key: "firstName", label: "First name", patterns: [/first.?name/i, /given.?name/i, /\bfname\b/i] },
    { key: "middleName", label: "Middle name", patterns: [/middle.?name/i, /\bmname\b/i, /additional-name/i] },
    { key: "lastName", label: "Last name", patterns: [/last.?name/i, /family.?name/i, /surname/i, /\blname\b/i] },
    { key: "fullName", label: "Full name", patterns: [/full.?name/i, /legal.?name/i] },
    { key: "email", label: "Email", patterns: [/e-?mail/i] },
    { key: "phoneExtension", label: "Phone extension", patterns: [/phone.{0,10}ext/i, /\bextension\b/i] },
    { key: "phoneType", label: "Phone device type", patterns: [/phone.{0,10}(device.?)?type/i] },
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
    { key: "country", label: "Country", patterns: [/country/i] },

    // Common screening questions, seen worded many different ways across sites.
    { key: "workAuthorized", label: "Authorized to work", patterns: [/authorized.{0,15}work/i, /legally.{0,10}(authorized|work)/i] },
    { key: "needsSponsorship", label: "Needs visa sponsorship", patterns: [/sponsorship/i, /sponsor.{0,10}visa/i] },
    { key: "citizenshipStatus", label: "Citizenship / residency status", patterns: [/us citizen/i, /lawful permanent resident/i, /green card/i, /\basylee\b/i, /\brefugee\b/i] },
    { key: "over18", label: "Over 18", patterns: [/over.?18/i, /18.?years.?of.?age/i, /18 years? or older/i, /age of 18/i] },
    { key: "driversLicense", label: "Driver's license", patterns: [/driver'?s?\s*license/i] },
    { key: "backgroundCheckConsent", label: "Background check / drug test consent", patterns: [/background.?check/i, /e-?verify/i, /drug test/i] },
    { key: "nonCompete", label: "Non-compete agreement", patterns: [/non-?compete/i, /non-?solicitation/i] },
    { key: "conflictOfInterest", label: "Conflict of interest", patterns: [/conflict of interest/i] },

    // Voluntary demographic (EEO) questions — left blank in your profile
    // unless you choose to fill them in, since they're optional by law.
    { key: "genderIdentity", label: "Gender", patterns: [/\bgender\b/i, /\bsex\b/i] },
    { key: "raceEthnicity", label: "Race / ethnicity", patterns: [/\brace\b/i, /ethnicity/i] },
    { key: "disabilityStatus", label: "Disability status", patterns: [/disability/i] },
    { key: "veteranStatus", label: "Veteran status", patterns: [/veteran/i] }
  ];
})();
