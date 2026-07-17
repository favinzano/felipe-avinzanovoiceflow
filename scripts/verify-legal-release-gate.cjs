const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const approvalPath = path.resolve(process.argv[2] || path.join(root, "docs", "legal-release-approval.json"));
const termsVersion = "2026-07-17-beta-1";
const expectedUrls = {
  termsEs: "https://felipeavinzano.com/voiceflow/legal/terminos",
  privacyEs: "https://felipeavinzano.com/voiceflow/legal/privacidad",
  termsEn: "https://felipeavinzano.com/voiceflow/legal/en/terms",
  privacyEn: "https://felipeavinzano.com/voiceflow/legal/en/privacy",
  contact: "https://felipeavinzano.com/voiceflow/legal/contacto"
};

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

async function verifyPublicPage(label, url) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  assert.ok(response.ok, `${label} returned HTTP ${response.status}: ${url}`);
  const content = await response.text();
  assert.match(content, /VoiceFlow/i, `${label} does not identify VoiceFlow.`);
  if (label === "contact") assert.match(content, /legal@felipeavinzano\.com/i, "The public contact page does not expose the legal email.");
  if (label !== "contact") {
    assert.ok(content.includes(termsVersion) || /17 (?:de )?julio de 2026|July 17, 2026/i.test(content), `${label} does not expose the reviewed document version/date.`);
  }
}

async function run() {
  assert.ok(fs.existsSync(approvalPath), `Public release blocked: missing ${path.relative(root, approvalPath)}. Start from docs/legal-release-approval.example.json only after every external requirement is complete.`);
  const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(approval.status, "approved", "Legal release status must be approved.");
  assert.equal(approval.appVersion, packageJson.version, "Approval appVersion must match package.json.");
  assert.equal(approval.termsVersion, termsVersion, "Approval Terms version is stale.");
  assert.equal(approval.legalEmail, "legal@felipeavinzano.com", "Legal contact email does not match the product.");
  assert.ok(validDate(approval.legalEmailCheck?.completedAt), "Operational legal-email check date is missing or invalid.");
  assert.ok(typeof approval.legalEmailCheck?.evidenceReference === "string" && approval.legalEmailCheck.evidenceReference.trim().length >= 5, "Operational legal-email evidence reference is missing.");
  assert.ok(typeof approval.commercialMailbox === "string" && approval.commercialMailbox.length >= 12, "A complete commercial mailbox is required.");
  assert.doesNotMatch(approval.commercialMailbox, /todo|tbd|placeholder|example|residential|pendiente|replace/i, "Commercial mailbox contains a placeholder or residential marker.");
  assert.deepEqual(approval.publicUrls, expectedUrls, "Public legal URLs must match the stable URL contract.");

  assert.ok(typeof approval.attorneyReview?.reviewer === "string" && approval.attorneyReview.reviewer.trim().length >= 3, "Attorney reviewer is missing.");
  assert.ok(validDate(approval.attorneyReview?.approvedAt), "Attorney approval date is missing or invalid.");
  assert.ok(typeof approval.attorneyReview?.evidenceReference === "string" && approval.attorneyReview.evidenceReference.trim().length >= 5, "Attorney approval evidence reference is missing.");
  assert.equal(approval.attorneyReview?.floridaConsumerTechnology, true, "Florida consumer/technology review is not confirmed.");
  assert.equal(approval.attorneyReview?.europeanConsumers, true, "European consumer review is not confirmed.");
  assert.equal(approval.attorneyReview?.spanishAndEnglish, true, "Bilingual equivalence review is not confirmed.");

  assert.ok(validDate(approval.networkAudit?.completedAt), "Network audit completion date is missing or invalid.");
  assert.ok(typeof approval.networkAudit?.evidenceReference === "string" && approval.networkAudit.evidenceReference.trim().length >= 5, "Network audit evidence reference is missing.");
  assert.deepEqual([...new Set(approval.networkAudit?.systems || [])].sort(), ["linux", "macos", "windows"], "Network audit must cover Windows, macOS, and Linux.");
  assert.equal(approval.networkAudit?.zeroUserContentMatches, true, "Canary testing did not confirm zero user-content matches.");
  assert.equal(approval.networkAudit?.onlyInventoriedHosts, true, "Network audit did not confirm only inventoried hosts.");

  for (const file of ["TERMS.md", "TERMS.en.md", "PRIVACY.md", "PRIVACY.en.md"]) {
    assert.ok(read(file).includes(approval.commercialMailbox), `${file} does not contain the approved commercial mailbox.`);
  }

  await Promise.all(Object.entries(expectedUrls).map(([label, url]) => verifyPublicPage(label, url)));
  console.log(`Legal release gate approved for VoiceFlow ${approval.appVersion}.`);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
