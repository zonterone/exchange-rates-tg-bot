import { config } from "dotenv";

// the only place that reads process.env: importing this module loads .env
// before anything else can look at a variable that is not there yet
config({ quiet: true });

// an empty variable is the same as an unset one: `.env.example` ships every
// key with no value, and a blank path would resolve to nonsense
export const env = {
  token: process.env["BOT_TOKEN"] || undefined,
  // multitransfer antifraud session id, see docs/adr/0001
  session: process.env["MT_FHP_SESSION_ID"] || undefined,
  db: process.env["DB_PATH"] || undefined,
  assets: process.env["ASSETS_PATH"] || undefined,
};
