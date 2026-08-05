import { Resvg } from "@resvg/resvg-js";
import { Result, ok } from "neverthrow";
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

export const toPng = Result.fromThrowable(
  (svg: string) =>
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
      .asPng(),
  (cause) => {
    console.error("card render failed", cause);
    return "render" as const;
  }
);

let cached: { updatedDate: number; png: Buffer } | null = null;

// rates change every half an hour, so the card is drawn once per update
export const ratesPng = (snapshot: Snapshot): Result<Buffer, "render"> => {
  if (cached?.updatedDate === snapshot.updatedDate) return ok(cached.png);

  return toPng(ratesCard(snapshot)).andTee((png) => {
    cached = { updatedDate: snapshot.updatedDate, png };
  });
};
