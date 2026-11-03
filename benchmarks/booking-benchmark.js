import "dotenv/config";
import autocannon from "autocannon";

const {
  BENCHMARK_TOKEN,
  BENCHMARK_RESOURCE_ID,
  BENCHMARK_DATE,
  BENCHMARK_START_TIME,
} = process.env;

if (
  !BENCHMARK_TOKEN ||
  !BENCHMARK_RESOURCE_ID ||
  !BENCHMARK_DATE ||
  !BENCHMARK_START_TIME
) {
  throw new Error("Set all BENCHMARK_ variables in .env first");
}

const result = await autocannon({
  url: "http://localhost:3000/bookings",
  title: `Booking strategy: ${process.env.BOOKING_STRATEGY}`,
  connections: 20,
  amount: 200,
  pipelining: 1,
  method: "POST",
  headers: {
    Authorization: `Bearer ${BENCHMARK_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    resourceId: BENCHMARK_RESOURCE_ID,
    date: BENCHMARK_DATE,
    startTime: BENCHMARK_START_TIME,
  }),
});

process.stdout.write(
  autocannon.printResult(result, { renderLatencyTable: true }),
);

console.log("Status counts:", result.statusCodeStats);
console.log(
  "Successful bookings per second:",
  (
    Number(result.statusCodeStats["201"]?.count ?? 0) / result.duration
  ).toFixed(2),
);