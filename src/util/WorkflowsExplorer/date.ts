import spacetime from 'spacetime';

export const getISOString = (date: Date, timezone?: string): string => {
  if (timezone) {
    return spacetime(date, 'GMT+0').goto(`${timezone}`).unixFmt('MM-dd-yyyy HH:mm:ss');
  }
  return spacetime(date, 'GMT+0').unixFmt('MM-dd-yyyy HH:mm:ss');
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

export const durationMicro = (duration: string) => {
  duration = duration.split('T')[1];
  
  if (duration.includes('H')) {
    const hours: number = parseInt(duration.split('H')[0]);
    duration = duration.split('H')[1];
    const minutes: number = parseInt(duration.split('M')[0]);
    duration = duration.split('M')[1];
    const seconds: number = parseInt(duration.split('.')[0]);
    duration = duration.split('.')[1];
    const mseconds: number = parseInt(duration);

    return (mseconds + seconds*1000) + minutes*60*1000 + hours*60*60*1000;
  } else if (duration.includes('M')) {
    const minutes: number = parseInt(duration.split('M')[0]);
    duration = duration.split('M')[1];
    const seconds: number = parseInt(duration.split('.')[0]);
    duration = duration.split('.')[1];
    const mseconds: number = parseInt(duration);
    
    return (mseconds + seconds*1000) + minutes*60*1000;
  } else {
    return parseFloat(duration.split('S')[0])*1000;
  }
}
