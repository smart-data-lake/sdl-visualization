import spacetime from 'spacetime';

export const formatTimestamp = (date: Date, timezone?: string): string => {
  if (timezone) {
    return spacetime(date, 'GMT+0').goto(`${timezone}`).unixFmt('dd.MM.yyyy HH:mm:ss');
  }
  return spacetime(date, 'GMT+0').unixFmt('dd.MM.yyyy HH:mm:ss');
};

export const getTimestampString = (date: Date, timezone?: string): string => {
  if (timezone) {
    return spacetime(date, 'GMT+0').goto(`${timezone}`).unixFmt('HH:mm:ss');
  }
  return spacetime(date, 'GMT+0').unixFmt('HH:mm:ss');
};

export const getTimeRangeString = (date: Date, timezone?: string): string => {
  if (timezone) {
    return spacetime(date, 'GMT+0').goto(`${timezone}`).unixFmt('yyyy-MM-dd HH:mm');
  }
  return spacetime(date, 'GMT+0').unixFmt('yyyy-MM-dd HH:mm');
};

export const getDateTimeLocalString = (date: Date, timezone?: string): string => {
  if (timezone) {
    return spacetime(date, 'GMT+0').goto(`${timezone}`).unixFmt('yyyy-MM-dd HH:mm:ss');
  }
  return spacetime(date, 'GMT+0').unixFmt('yyyy-MM-dd HH:mm:ss');
};

// Return timepoint X days from now.
export const getTimeFromPastByDays = (days: number, timezone?: string): number => {
  if (timezone) {
    return spacetime.now(`${timezone}`).subtract(days, 'day').startOf('day').epoch;
  }
  return spacetime(Date.now() - 1000 * 60 * 60 * 24 * days).startOf('day').epoch;
};

export const durationMillis = (duration: string) => {
  const moment = require("moment");
  const d = moment.duration(duration);
  
  return Math.floor(d.asMilliseconds())
}
