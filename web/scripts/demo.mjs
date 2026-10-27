// A15: seed or reset the demo data on a running server.
//   npm run demo:seed  [-- http://localhost:3000]
//   npm run demo:reset [-- http://localhost:3000]
const [action, base = "http://localhost:3000"] = process.argv.slice(2);
if (action !== "seed" && action !== "reset") {
  console.error("usage: node scripts/demo.mjs seed|reset [baseUrl]");
  process.exit(1);
}

const headers = process.env.DEMO_KEY ? { "x-demo-key": process.env.DEMO_KEY } : {};
try {
  const res = await fetch(`${base}/api/demo/${action}`, { method: "POST", headers, signal: AbortSignal.timeout(60_000) });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${body.error ?? ""}`);
  console.log(`demo ${action}: ${body.reports} reports`);
} catch (err) {
  console.error(`demo ${action} failed (is the server running at ${base}?):`, err.message);
  process.exit(1);
}
