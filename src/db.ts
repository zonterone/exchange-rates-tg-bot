import { JsonDB, Config } from "node-json-db";
import * as path from "path";

export const dbPath =
  process.env["DB_PATH"] ?? path.resolve(process.cwd(), "db/db");

export const db = new JsonDB(
  new Config(dbPath, true, true, "/")
);
