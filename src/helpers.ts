export const getTimeDiffInMinutes = (date: number) => { 
  const now = new Date()
  const diff = now.getTime() - date
  return Math.round(diff / 1000 / 60)
}