import "dotenv/config";
import { performance } from "node:perf_hooks";

const url = "http://localhost:3000/bookings";
const token = process.env.BENCHMARK_TOKEN;
const resourceId = process.env.BENCHMARK_RESOURCE_ID;
const baseDate = process.env.BENCHMARK_DATE;
const firstStartTime = process.env.BENCHMARK_START_TIME;

// Defaults match a 09:00-14:00 resource with ten 30-minute slots per day.
const CONCURRENCY = Number(process.env.BENCHMARK_CONCURRENCY ?? 20);
const ROUNDS = Number(process.env.BENCHMARK_ROUNDS ?? 10);
const SLOT_MINUTES = Number(process.env.BENCHMARK_SLOT_MINUTES ?? 30);
const SLOTS_PER_DAY = Number(process.env.BENCHMARK_SLOTS_PER_DAY ?? 10);

if (!token || !resourceId || !baseDate || !firstStartTime) {
  throw new Error("Set BENCHMARK_TOKEN, BENCHMARK_RESOURCE_ID, BENCHMARK_DATE, and BENCHMARK_START_TIME in .env");
}

for (const [name, value] of Object.entries({
  BENCHMARK_CONCURRENCY: CONCURRENCY,
  BENCHMARK_ROUNDS: ROUNDS,
  BENCHMARK_SLOT_MINUTES: SLOT_MINUTES,
  BENCHMARK_SLOTS_PER_DAY: SLOTS_PER_DAY,
})) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(firstStartTime)) {
  throw new Error("BENCHMARK_DATE must be YYYY-MM-DD and BENCHMARK_START_TIME must be HH:mm");
}

const totalRequests = CONCURRENCY * ROUNDS;
const totalDays = Math.ceil(totalRequests / SLOTS_PER_DAY);

function slotForIndex(index) {
  const dayOffset = Math.floor(index / SLOTS_PER_DAY);
  const slotInDay = index % SLOTS_PER_DAY;
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);

  const [startHour, startMinute] = firstStartTime.split(":").map(Number);
  const minutesFromMidnight = startHour * 60 + startMinute + slotInDay * SLOT_MINUTES;
  if (minutesFromMidnight + SLOT_MINUTES > 24 * 60) {
    throw new Error("Generated slot crosses midnight; adjust the start time or slots per day");
  }

  const hour = String(Math.floor(minutesFromMidnight / 60)).padStart(2, "0");
  const minute = String(minutesFromMidnight % 60).padStart(2, "0");
  return { date: date.toISOString().slice(0, 10), startTime: `${hour}:${minute}` };
}

async function timedBooking(body) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let responseBody = null;
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { unparsedBody: responseText.slice(0, 200) };
      }
    }

    return {
      status: response.status,
      error: responseBody?.error ?? responseBody?.code ?? null,
      ms: performance.now() - startedAt,
    };
  } catch (error) {
    return {
      status: "NETWORK_ERROR",
      error: error.message,
      ms: performance.now() - startedAt,
    };
  }
}

async function runRound(round) {
  const firstIndex = round * CONCURRENCY;
  return Promise.all(
    Array.from({ length: CONCURRENCY }, (_, requestIndex) => {
      const slot = slotForIndex(firstIndex + requestIndex);
      return timedBooking({ resourceId, ...slot });
    }),
  );
}

function percentile(sortedValues, p) {
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * p) - 1);
  return sortedValues[index];
}

const all = [];
const startedAt = performance.now();
for (let round = 0; round < ROUNDS; round++) {
  all.push(...(await runRound(round)));
}
const seconds = (performance.now() - startedAt) / 1000;

const statusCounts = all.reduce((counts, result) => {
  counts[result.status] = (counts[result.status] ?? 0) + 1;
  return counts;
}, {});
const errorCounts = all.reduce((counts, result) => {
  if (result.error) counts[result.error] = (counts[result.error] ?? 0) + 1;
  return counts;
}, {});
const sortedLatencies = all.map((result) => result.ms).sort((a, b) => a - b);
const successCount = statusCounts[201] ?? 0;
const falseConflictCount = statusCounts[409] ?? 0;
const unexpectedStatuses = Object.keys(statusCounts).filter(
  (status) => status !== "201" && status !== "409",
);

console.log("Strategy:", process.env.BOOKING_STRATEGY ?? "(label not set)");
console.log(`Setup: ${ROUNDS} rounds x ${CONCURRENCY} simultaneous requests = ${all.length} requests`);
console.log(`Unique slots: ${totalRequests}; date span: ${totalDays} day(s); slots/day: ${SLOTS_PER_DAY}`);
console.log("Status counts:", statusCounts);
console.log(`201 success rate: ${((successCount / all.length) * 100).toFixed(1)}% (${successCount}/${all.length})`);
console.log(`409 false conflicts: ${falseConflictCount} (${((falseConflictCount / all.length) * 100).toFixed(1)}%)`);
console.log("Error tally:", errorCounts);
console.log(`p50: ${percentile(sortedLatencies, 0.5).toFixed(1)} ms`);
console.log(`p95: ${percentile(sortedLatencies, 0.95).toFixed(1)} ms`);
console.log(`p99: ${percentile(sortedLatencies, 0.99).toFixed(1)} ms`);
console.log(`Throughput: ${(all.length / seconds).toFixed(1)} req/s`);

if (unexpectedStatuses.length > 0) {
  console.warn(`WARNING: unexpected statuses (${unexpectedStatuses.join(", ")}); investigate before comparing this run.`);
}
if (successCount !== totalRequests) {
  console.warn("WARNING: expected every request to return 201 because each request uses a different slot.");
}
