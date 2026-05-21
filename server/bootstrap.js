import "./utils/loadServerEnv.js";

function logProcessError(label, err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[Process] ${label}`);
  console.error(
    `[Process] code=${error.code || "n/a"} errno=${error.errno ?? "n/a"} sqlMessage=${error.sqlMessage || "n/a"}`,
  );
  console.error(`[Process] message=${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
}

process.on("unhandledRejection", (reason) => {
  logProcessError("unhandledRejection", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logProcessError("uncaughtException", error);
  process.exit(1);
});

import("./index.js").catch((error) => {
  logProcessError("bootstrap import failure", error);
});
