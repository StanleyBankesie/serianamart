import { getDbConfig } from "../db/pool.js";
export const dbConfig = async (req, res) => {
  try {
    const cfg = getDbConfig();
    res.json({ ok: true, config: cfg });
  } catch {
    res.status(500).json({ ok: false });
  }
};
