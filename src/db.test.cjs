const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  clearTranscriptions,
  closeDb,
  deleteTranscription,
  getAllTranscriptions,
  initDb,
  insertTranscription,
  migrateLegacyHistory,
  trimTranscriptions
} = require("./db.cjs");

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voiceflow-db-"));
  initDb(root);

  assert.deepEqual(getAllTranscriptions(), []);

  const first = insertTranscription("hola mundo", "2026-01-01T00:00:00.000Z");
  assert.equal(first.texto, "hola mundo");
  assert.equal(first.fecha, "2026-01-01T00:00:00.000Z");
  assert.ok(Number.isInteger(first.id));

  const second = insertTranscription("segunda nota", "2026-01-02T00:00:00.000Z");
  let rows = getAllTranscriptions();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].texto, "segunda nota");
  assert.equal(rows[1].texto, "hola mundo");

  assert.equal(getAllTranscriptions(1).length, 1);

  deleteTranscription(first.id);
  rows = getAllTranscriptions();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, second.id);

  insertTranscription("tercera", "2026-01-03T00:00:00.000Z");
  insertTranscription("cuarta", "2026-01-04T00:00:00.000Z");
  trimTranscriptions(2);
  rows = getAllTranscriptions();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].texto, "cuarta");
  assert.equal(rows[1].texto, "tercera");

  clearTranscriptions();
  assert.deepEqual(getAllTranscriptions(), []);

  migrateLegacyHistory([
    { text: "reciente", at: "2026-02-02T00:00:00.000Z" },
    { text: "antigua", at: "2026-02-01T00:00:00.000Z" }
  ]);
  rows = getAllTranscriptions();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].texto, "reciente");
  assert.equal(rows[1].texto, "antigua");

  migrateLegacyHistory([{ text: "no debe insertarse", at: "2026-03-01T00:00:00.000Z" }]);
  assert.equal(getAllTranscriptions().length, 2);

  closeDb();
  await fs.rm(root, { recursive: true, force: true });
  console.log("DB: 10 checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
