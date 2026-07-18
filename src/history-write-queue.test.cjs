const assert = require("node:assert/strict");
const { createHistoryWriteQueue } = require("./history-write-queue.cjs");

(async () => {
  const calls = [];
  const scheduled = [];
  const queue = createHistoryWriteQueue({
    insert: (text) => calls.push(["insert", text]),
    trim: (limit) => calls.push(["trim", limit]),
    schedule: (callback) => scheduled.push(callback)
  });
  queue.enqueue("uno", 30);
  assert.equal(queue.pending(), 1);
  assert.deepEqual(calls, []);
  while (!scheduled.length) await Promise.resolve();
  scheduled.shift()();
  await queue.flush();
  assert.deepEqual(calls, [["insert", "uno"], ["trim", 30]]);
  assert.equal(queue.pending(), 0);
  console.log("History write queue: 5 checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
