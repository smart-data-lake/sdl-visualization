import spacetime from 'spacetime';
import moment from 'moment';

const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const parseUtcDate = (date?: number|string): Date|undefined => {
  if (!date) return undefined;
  if (typeof date === "string") return spacetime(date).toNativeDate();
  if (typeof date === "number") return spacetime(date).toNativeDate();
}

export const formatTimestamp = (date: Date, timezone?: string): string => {
  if (!date) return '-'; 
  return spacetime(date).unixFmt('dd.MM.yyyy HH:mm:ss');
};

/** The label of an export version; one written without a timestamp is simply the latest. */
export const formatTstampEntryLabel = (entry: { tstamp?: Date }): string =>
  entry.tstamp ? formatTimestamp(entry.tstamp) : 'latest';

export const durationMillis = (duration: string) => {
  const d = moment.duration(duration);
  
  return Math.floor(d.asMilliseconds())
}
