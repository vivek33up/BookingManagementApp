import "dotenv/config";
import { performance } from "node:perf_hooks";

const url = "http://localhost:3000/bookings";
const token = process.env.BENCHMARK_TOKEN;
const resourceId = process.env.BENCHMARK_RESOURCE_ID;
const baseDate = process.env.BENCHMARK_DATE; // YYYY-MM-DD, first date to use
const startTime = process.env.BENCHMARK_START_TIME;

const CONCURRENCY = Number(process.env.BENCHMARK_CONCURRENCY ?? 20);
const ROUNDS = Number(process.env.BENCHMARK_ROUNDS ?? 20);
const WARMUP_ROUNDS = 0; // not counted, just warms up connections and the pool

if (!token || !resourceId || !baseDate || !startTime) {
  throw new Error("Set the BENCHMARK_ variables in .env first");
}

// Each round gets its own date, so every round is a fresh race for one slot.
// If your API limits how far ahead you can book, change this to vary
// startTime instead (or use more resources).
function dateForRound(round) {
  const d = new Date(`${baseDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + round);
  return d.toISOString().slice(0, 10);
}

async function timedBooking(body) {
  const t0 = performance.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    await response.text();
    return { status: response.status, ms: performance.now() - t0 };
  } catch {
    return { status: "NETWORK_ERROR", ms: performance.now() - t0 };
  }
}

async function runRound(round) {
  const body = { resourceId, date: dateForRound(round), startTime };
  // All requests start at the same moment: a real race for one slot.
  return Promise.all(
    Array.from({ length: CONCURRENCY }, () => timedBooking(body)),
  );
}

function percentile(sortedValues, p) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * p) - 1,
  );
  return sortedValues[index];
}

// Warmup (results discarded)
for (let i = 0; i < WARMUP_ROUNDS; i++) {
  await runRound(i);
}

const all = [];
const winnersPerRound = [];
const start = performance.now();

for (let round = 0; round < ROUNDS; round++) {
  // +WARMUP_ROUNDS so we never reuse a warmup date
  const results = await runRound(round + WARMUP_ROUNDS);
  all.push(...results);
  winnersPerRound.push(results.filter((r) => r.status === 201).length);
}

const seconds = (performance.now() - start) / 1000;
const latencies = all.map((r) => r.ms).sort((a, b) => a - b);

const statusCounts = all.reduce((counts, r) => {
  counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}, {});

const perfectRounds = winnersPerRound.filter((w) => w === 1).length;

console.log("Strategy:", process.env.BOOKING_STRATEGY ?? "(set BOOKING_STRATEGY in .env to label runs)");
console.log(`Setup: ${ROUNDS} rounds x ${CONCURRENCY} simultaneous requests = ${all.length} requests`);
console.log("Status counts:", statusCounts);
console.log(`Rounds with exactly 1 success: ${perfectRounds}/${ROUNDS}`);
console.log(`p50: ${percentile(latencies, 0.5).toFixed(1)} ms`);
console.log(`p95: ${percentile(latencies, 0.95).toFixed(1)} ms`);
console.log(`p99: ${percentile(latencies, 0.99).toFixed(1)} ms`);
console.log(`Throughput: ${(all.length / seconds).toFixed(1)} req/s`);

const bad = Object.keys(statusCounts).filter(
  (s) => s !== "201" && s !== "409",
);
if (bad.length > 0) {
  console.warn(
    `WARNING: unexpected statuses (${bad.join(", ")}). Do not use this run as proof.`,
  );
}