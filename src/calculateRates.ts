import { db } from "./db";
import { findBestRateLabel, getTimeDiffInMinutes } from "./helpers";
import { Rates } from "./updateRates";

export const calculateRatesFromRub = async (
  currency: "GEL" | "USD",
  sum: number
) => {
  const rates = (await db.getData(`/rates`)) as Rates;

  const sign = Math.sign(
    Math.max(rates.ByBitBuyRUBToUsdt, rates[`ByBitSellUsdtTo${currency}`])
  );

  const rubToCurrencyInByBit =
    sign *
    (sum / (rates.ByBitBuyRUBToUsdt / rates[`ByBitSellUsdtTo${currency}`]));

  const rubToCurrencyInKoronaPay = sum / rates[`koronaRate${currency}`];

  console.log(rubToCurrencyInByBit, rubToCurrencyInKoronaPay);
  const bestPlatform = findBestRateLabel.findMax([
    { label: "ByBit" as const, value: rubToCurrencyInByBit },
    { label: "KoronaPay" as const, value: rubToCurrencyInKoronaPay },
  ]);
  return `CBR
RUB->${currency}: ${sum}RUB=${(sum / rates[`CBRRate${currency}`]).toFixed(
    2
  )}${currency}
-------------------------
ByBit
RUB->USDT->${currency}: ${sum}RUB=${
    rubToCurrencyInByBit < 0 ? "❌" : rubToCurrencyInByBit.toFixed(2)
  }${currency} ${bestPlatform === "ByBit" ? "👍" : ""}
-------------------------
KoronaPay
RUB->${currency}: ${sum}RUB=${
    rubToCurrencyInKoronaPay < 0 ? "❌" : rubToCurrencyInKoronaPay.toFixed(2)
  }${currency} ${bestPlatform === "KoronaPay" ? "👍" : ""}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes
`;
};

export const calculateRatesToRub = async (
  currency: "GEL" | "USD",
  sum: number
) => {
  const rates = (await db.getData(`/rates`)) as Rates;

  const sign = Math.sign(
    Math.max(rates.ByBitBuyRUBToUsdt, rates[`ByBitSellUsdtTo${currency}`])
  );

  const rubToCurrencyInByBit =
    sign *
    sum *
    (rates.ByBitBuyRUBToUsdt / rates[`ByBitSellUsdtTo${currency}`]);

  const rubToCurrencyInKoronaPay = sum * rates[`koronaRate${currency}`];

  const bestPlatform = findBestRateLabel.findMin([
    { label: "ByBit" as const, value: rubToCurrencyInByBit },
    { label: "KoronaPay" as const, value: rubToCurrencyInKoronaPay },
  ]);

  return `CBR
RUB->${currency}: ${(sum * rates[`CBRRate${currency}`]).toFixed(
    2
  )}RUB=${sum}${currency}
-------------------------
ByBit
RUB->USDT->${currency}: ${
    rubToCurrencyInByBit < 0 ? "❌" : rubToCurrencyInByBit.toFixed(2)
  }RUB=${sum}${currency} ${bestPlatform === "ByBit" ? "👍" : ""}
-------------------------
KoronaPay
RUB->${currency}: ${
    rubToCurrencyInKoronaPay < 0 ? "❌" : rubToCurrencyInKoronaPay.toFixed(2)
  }RUB=${sum}${currency}  ${bestPlatform === "KoronaPay" ? "👍" : ""}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes
`;
};
