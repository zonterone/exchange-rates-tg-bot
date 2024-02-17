export const getTimeDiffInMinutes = (date: number) => {
  const now = new Date()
  const diff = now.getTime() - date
  return Math.round(diff / 1000 / 60)
}

type Item = {
  label: 'ByBit' | 'KoronaPay'
  value: number
}
export const findBestRateLabel = {
  findMin: (values: Item[]) =>
    values
      .filter((item) => item.value >= 0)
      .sort((a, b) => a.value - b.value)[0].label,
  findMax: (values: Item[]) =>
    values
      .filter((item) => item.value >= 0)
      .sort((a, b) => b.value - a.value)[0].label,
}
