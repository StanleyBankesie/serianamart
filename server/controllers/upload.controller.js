import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

export const ensureUploadDir = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = path.join(__dirname, "../../uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const filePath = `/uploads/${req.file.filename}`;
    const origin = `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${origin}${filePath}`;
    res.json({
      message: "File uploaded successfully",
      url: fileUrl,
      path: filePath,
      filename: req.file.filename,
    });
  } catch (e) {
    next(e);
  }
};
