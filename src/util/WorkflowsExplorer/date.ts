import spacetime from 'spacetime';
import moment from 'moment';

const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const parseUtcDate = (date?: number|string): Date|undefined => {
  if (!date) return undefined;
  if (typeof date === "string") return spacetime(date, 'GMT+0').toNativeDate();
  if (typeof date === "number") return spacetime(date, 'GMT+0').toNativeDate();
}

export const formatTimestamp = (date: Date, timezone?: string): string => {
  if (!date) return '-'; 
  return spacetime(date, 'GMT+0').goto(timezone || clientTimezone).unixFmt('dd.MM.yyyy HH:mm:ss');
};

export const durationMillis = (duration: string) => {
  const d = moment.duration(duration);
  
  return Math.floor(d.asMilliseconds())
}
