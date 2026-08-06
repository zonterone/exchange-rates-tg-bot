import { config } from "dotenv";

// the only place that reads process.env: importing this module loads .env
// before anything else can look at a variable that is not there yet
config({ quiet: true });

// an empty variable is the same as an unset one: `.env.example` ships every
// key with no value, and a blank path would resolve to nonsense
export const env = {
  token: process.env["BOT_TOKEN"] || undefined,
  // the browser that mints the MultiTransfer antifraud session, see
  // docs/adr/0001; puppeteer-core ships no binary of its own, and the image
  // sets this to the chromium it installed
  chromium: process.env["CHROMIUM_PATH"] || undefined,
  db: process.env["DB_PATH"] || undefined,
  assets: process.env["ASSETS_PATH"] || undefined,
};
