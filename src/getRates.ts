import { db } from "./db";
import { findBestRateLabel, getTimeDiffInMinutes } from "./helpers";
import { Rates } from "./updateRates";

export const getRates = async () => {
  const rates = (await db.getData(`/rates`)) as Rates;

  const rubToGelInByBit = rates.ByBitBuyRUBToUsdt / rates.ByBitSellUsdtToGEL;

  const rubToUsdInByBit = rates.ByBitBuyRUBToUsdt / rates.ByBitSellUsdtToUSD;

  const bestRubToGelPlatform = findBestRateLabel.findMin([
    { label: "ByBit", value: rubToGelInByBit },
    { label: "KoronaPay", value: rates.koronaRateGEL },
  ]);

  const bestRubToUsdPlatform = findBestRateLabel.findMin([
    { label: "ByBit", value: rubToUsdInByBit },
    { label: "KoronaPay", value: rates.koronaRateUSD },
  ]);

  return `CBR
RUB->GEL: 1GEL=${rates.CBRRateGEL.toFixed(2)}RUB
RUB->USD: 1USD=${rates.CBRRateUSD.toFixed(2)}RUB
-------------------------
KoronaPay
RUB->GEL: 1GEL=${
    rates.koronaRateGEL < 0 ? "❌" : rates.koronaRateGEL.toFixed(2)
  }RUB ${bestRubToGelPlatform === "KoronaPay" ? "👍" : ""}
RUB->USD: 1USD=${
    rates.koronaRateUSD < 0 ? "❌" : rates.koronaRateUSD.toFixed(2)
  }RUB ${bestRubToUsdPlatform === "KoronaPay" ? "👍" : ""}
-------------------------
ByBit
Buy: 1USDT=${
    rates.ByBitBuyRUBToUsdt < 0 ? "❌" : rates.ByBitBuyRUBToUsdt.toFixed(2)
  }RUB
Sell: 1USDT=${
    rates.ByBitSellUsdtToGEL < 0 ? "❌" : rates.ByBitSellUsdtToGEL.toFixed(2)
  }GEL
Sell: 1USDT=${
    rates.ByBitSellUsdtToUSD < 0 ? "❌" : rates.ByBitSellUsdtToUSD.toFixed(2)
  }USD
RUB->USDT->GEL: 1GEL=${
    rubToGelInByBit < 0 ? "❌" : rubToGelInByBit.toFixed(2)
  }RUB ${bestRubToGelPlatform === "ByBit" ? "👍" : ""}
RUB->USDT->USD: 1USD=${
    rubToUsdInByBit < 0 ? "❌" : rubToUsdInByBit.toFixed(2)
  }RUB ${bestRubToUsdPlatform === "ByBit" ? "👍" : ""}
-------------------------
Last update: ${getTimeDiffInMinutes(rates.updatedDate)} minutes ago
Rates are usually updated every 30 minutes

If you want to calculate sum send it to me
`;
};
