import spacetime from 'spacetime';

const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const formatTimestamp = (date: Date, timezone?: string): string => {
  if (!date) return '-'; 
  return spacetime(date, 'GMT+0').goto(timezone || clientTimezone).unixFmt('dd.MM.yyyy HH:mm:ss');
};

export const getTimestampString = (date: Date, timezone?: string): string => {
  return spacetime(date, 'GMT+0').goto(timezone || clientTimezone).unixFmt('HH:mm:ss');
};

export const getTimeRangeString = (date: Date, timezone?: string): string => {
  return spacetime(date, 'GMT+0').goto(timezone || clientTimezone).unixFmt('yyyy-MM-dd HH:mm');
};

export const getDateTimeLocalString = (date: Date, timezone?: string): string => {
  return spacetime(date, 'GMT+0').goto(timezone || clientTimezone).unixFmt('yyyy-MM-dd HH:mm:ss');
};

// Return timepoint X days from now.
export const getTimeFromPastByDays = (days: number, timezone?: string): number => {
  return spacetime.now(timezone || clientTimezone).subtract(days, 'day').startOf('day').epoch;
};

export const durationMillis = (duration: string) => {
  const moment = require("moment");
  const d = moment.duration(duration);
  
  return Math.floor(d.asMilliseconds())
}
