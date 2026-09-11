const brasiliaDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

export function reportingCutoff(year: number, now = new Date()) {
  const today = brasiliaDate(now);
  const yearEnd = `${year}-12-31`;
  return today < yearEnd ? today : yearEnd;
}

export function annualReportingPeriod(year: number, now = new Date()) {
  return { from: `${year}-01-01`, to: reportingCutoff(year, now), grain: 'year' as const };
}
