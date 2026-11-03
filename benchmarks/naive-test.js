import "dotenv/config";

const url = "http://localhost:3000/bookings";
const token = process.env.BENCHMARK_TOKEN;

const body = {
  resourceId: process.env.BENCHMARK_RESOURCE_ID,
  date: process.env.BENCHMARK_DATE,
  startTime: process.env.BENCHMARK_START_TIME,
};

if (!token || !body.resourceId || !body.date || !body.startTime) {
  throw new Error("Set the BENCHMARK_ variables in .env first");
}

async function sendBooking() {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    let responseBody;
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = text;
    }

    return { status: response.status, body: responseBody };
  } catch (error) {
    return { status: "NETWORK_ERROR", body: error.message };
  }
}

async function sendWave(number) {
  const results = await Promise.all(
    Array.from({ length: 50 }, () => sendBooking()),
  );

  const counts = results.reduce((total, result) => {
    total[result.status] = (total[result.status] ?? 0) + 1;
    return total;
  }, {});

  console.log(`Wave ${number} status counts:`, counts);
  return results;
}

const wave1 = await sendWave(1);
const wave2 = await sendWave(2);

console.log("All responses:");
console.log(JSON.stringify([...wave1, ...wave2], null, 2));