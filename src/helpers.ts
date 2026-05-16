export const getTimeDiffInMinutes = (date: number) => {
  const now = new Date();
  const diff = now.getTime() - date;
  return Math.round(diff / 1000 / 60);
};

const isValidRate = (value: number) => Number.isFinite(value) && value > 0;

export const formatRate = (value: number) =>
  isValidRate(value) ? value.toFixed(2) : "❌";

export const isPositiveRate = isValidRate;

export const currencySymbols = {
  GEL: "₾",
  RUB: "₽",
  USD: "$",
} as const;
