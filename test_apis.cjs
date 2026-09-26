const http = require("http");

function query(urlPath, method, postData) {
  return new Promise((resolve) => {
    const dataStr = postData ? JSON.stringify(postData) : null;
    const req = http.request({
      hostname: "127.0.0.1",
      port: 5000,
      path: urlPath,
      method: method || "GET",
      headers: dataStr ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dataStr) } : {}
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body || "{}") }));
    });
    req.on("error", (e) => resolve({ error: e.message }));
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function main() {
  const r1 = await query("/api/followup/cases");
  console.log("1. Followup Cases:", r1.status, "Count:", r1.body.count, "Ref:", r1.body.cases?.[0]?.case_ref);

  const r2 = await query("/api/alerts?district=Sangli");
  console.log("2. District Alerts:", r2.status, "Count:", r2.body.count, "Top:", r2.body.alerts?.[0]?.title);

  const r3 = await query("/api/ml/experiments");
  console.log("3. ML Experiments:", r3.status, "Benchmarks:", r3.body.totalExperiments);

  const r4 = await query("/api/chatbot/query", "POST", {
    question: "फवारणीनंतर पाऊस आला तर काय करावे?",
    activeCaseRef: "CASE-2026-1024",
    language: "mr"
  });
  console.log("4. Context Chatbot:", r4.status, "Answer length:", r4.body.answer?.length, "Case injected:", r4.body.context?.caseRef);
}
main();
