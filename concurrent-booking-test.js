const url = "http://localhost:3000/bookings";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MTNmYzMwMS05MmI3LTQ3NTMtYTRkMy0xMWM1ZjBhNWRkYTkiLCJpYXQiOjE3OTM1NDc0MjAsImV4cCI6MTc5MzU1MTAyMH0.4yyZtxtNz4udQwjfRivtLiEzTlBQLsizXTADjRAzo8w";

const body = {
  resourceId: "480c3e54-5606-4a57-82f1-87c2dfb40475",
  date: "2026-11-02",
  startTime: "11:00",
};

async function sendBooking() {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();

  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = responseText;
  }

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: responseBody,
  };
}
const results = await Promise.all([sendBooking(), sendBooking()]);
console.log(JSON.stringify(results, null, 2));