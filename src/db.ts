import { JsonDB, Config } from "node-json-db";
import * as fs from "fs";
import { Result, ok } from "neverthrow";
import * as path from "path";
import { env } from "./env";

export const dbPath = env.db ?? path.resolve(process.cwd(), "db/db");
const dbFile = path.extname(dbPath) === "" ? `${dbPath}.json` : dbPath;
const maxDbBytes = 10 * 1024 * 1024;

const rename = Result.fromThrowable(
  (file: string, backup: string) => fs.renameSync(file, backup),
  (cause) => {
    console.error("Failed to move the database aside", cause);
    return "unmovable" as const;
  }
);

const moveAside = (file: string, kind: "corrupt" | "oversized") => {
  const backup = `${file}.${kind}-${Date.now()}`;

  return rename(file, backup).map(() => {
    console.error(`Database moved to ${backup}`);
    return backup;
  });
};

// a file that is not there yet is as usable as a healthy one: json-db writes
// it on the first push
const inspect = Result.fromThrowable(
  (file: string) => {
    if (!fs.existsSync(file)) return "usable" as const;
    if (fs.statSync(file).size > maxDbBytes) return "oversized" as const;

    JSON.parse(fs.readFileSync(file, "utf8"));
    return "usable" as const;
  },
  (cause) => {
    // a file we cannot even stat reads the same as a half-written one from
    // here, and only the cause says which of the two it was
    console.error("Database could not be read", cause);
    return "corrupt" as const;
  }
);

// writes are not atomic, so a kill mid-save leaves a half-written file — and
// json-db then throws on every call, for good, until someone deletes it
export const guard = (file: string): Result<string | null, "unmovable"> =>
  inspect(file).match(
    (state) => (state === "oversized" ? moveAside(file, state) : ok(null)),
    (kind) => moveAside(file, kind)
  );

// nothing left to decide here: the cause is logged where it is caught, and a
// file that could not be moved aside dooms the process either way
guard(dbFile);

export const db = new JsonDB(
  new Config(dbPath, true, true, "/")
);
