import { signAccessToken } from "./server/services/token.service.js";

async function run() {
  try {
    const token = signAccessToken({
      sub: 1,
      id: 1,
      username: "dev",
      email: "dev@local",
      permissions: ["*"],
      companyIds: [1],
      branchIds: [1],
    });

    console.log("Calling API endpoint directly with signed Bearer token...");
    const res = await fetch("http://localhost:4002/api/inventory/transfer-acceptance", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-company-id": "1",
        "x-branch-id": "1",
      }
    });

    console.log("HTTP Status:", res.status);
    const text = await res.text();
    console.log("Response Body:", text);
  } catch (err) {
    console.error("HTTP Request failed:", err.message);
  }
  process.exit(0);
}
run();
