import { JsonDB, Config } from "node-json-db";
import * as fs from "fs";
import * as path from "path";

export const dbPath =
  process.env["DB_PATH"] ?? path.resolve(process.cwd(), "db/db");
const dbFile = path.extname(dbPath) === "" ? `${dbPath}.json` : dbPath;
const maxDbBytes = 10 * 1024 * 1024;

try {
  if (fs.existsSync(dbFile) && fs.statSync(dbFile).size > maxDbBytes) {
    const backup = `${dbFile}.oversized-${Date.now()}`;
    fs.renameSync(dbFile, backup);
    console.error(`Oversized database moved to ${backup}`);
  }
} catch (error) {
  console.error("Failed to check database size", error);
}

export const db = new JsonDB(
  new Config(dbPath, true, true, "/")
);
