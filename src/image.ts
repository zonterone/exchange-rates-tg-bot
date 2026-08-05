import { Resvg } from "@resvg/resvg-js";
import * as path from "path";
import { fontFamily, ratesCard } from "./card";
import { env } from "./env";
import type { Snapshot } from "./rates";

const assets = env.assets ?? path.resolve(process.cwd(), "assets");
const fontFiles = ["NotoSansMono-Regular.ttf", "NotoSansMono-Bold.ttf"].map(
  (file) => path.join(assets, file)
);

// telegram scales photos down, so render at twice the layout size
const density = 2;

export const toPng = (svg: string) =>
  new Resvg(svg, {
    background: "transparent",
    fitTo: { mode: "zoom", value: density },
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: fontFamily,
    },
  })
    .render()
    .asPng();

let cached: { updatedDate: number; png: Buffer } | null = null;

// rates change every half an hour, so the card is drawn once per update
export const ratesPng = (snapshot: Snapshot) => {
  if (cached?.updatedDate === snapshot.updatedDate) return cached.png;

  const png = toPng(ratesCard(snapshot));
  cached = { updatedDate: snapshot.updatedDate, png };
  return png;
};
