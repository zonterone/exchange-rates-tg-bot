import { JsonDB, Config } from "node-json-db";
import * as fs from "fs";
import * as path from "path";
import { env } from "./env";

export const dbPath = env.db ?? path.resolve(process.cwd(), "db/db");
const dbFile = path.extname(dbPath) === "" ? `${dbPath}.json` : dbPath;
const maxDbBytes = 10 * 1024 * 1024;

const moveAside = (file: string, kind: string) => {
  const backup = `${file}.${kind}-${Date.now()}`;

  try {
    fs.renameSync(file, backup);
    console.error(`Database moved to ${backup}`);
    return backup;
  } catch (error) {
    console.error("Failed to move the database aside", error);
    return null;
  }
};

// writes are not atomic, so a kill mid-save leaves a half-written file — and
// json-db then throws on every call, for good, until someone deletes it
export const guard = (file: string) => {
  try {
    if (!fs.existsSync(file)) return null;
    if (fs.statSync(file).size > maxDbBytes) return moveAside(file, "oversized");

    JSON.parse(fs.readFileSync(file, "utf8"));
    return null;
  } catch {
    return moveAside(file, "corrupt");
  }
};

guard(dbFile);

export const db = new JsonDB(
  new Config(dbPath, true, true, "/")
);
