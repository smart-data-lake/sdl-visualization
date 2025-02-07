import { DefaultTheme } from 'styled-components';

/**
 * Get browsers font size. User might have changed default of 16px.
 * @returns {number} Browser default font size in pixel
 */
export function getDocumentDefaultFontSize(): number | null {
  const size = getComputedStyle(document.documentElement).fontSize;
  if (size && size.indexOf('px') > -1) {
    return parseInt(size.split('px')[0]);
  }
  return null;
}

const DEFAULT_FONT_SIZE = getDocumentDefaultFontSize();

/**
 * If user has changed browser font value, we can't to scale pixel values according that.
 * For example if user has changed size from 16px to 14px, we need to multiple pixel value with 0.875
 * to match UI overall.
 * @param normalsize Pixel value to convert
 * @returns Converted pixel value
 */
export function toRelativeSize(normalsize: number): number {
  const multiplier = DEFAULT_FONT_SIZE ? DEFAULT_FONT_SIZE / 16 : 1;

  return normalsize * multiplier;
}

/**
 * Default colors for different statuses
 */
export function colorByStatus(theme: DefaultTheme, status: string): string {
  switch (status) {
    case 'PENDING':
      return theme.color.bg.dark;
    case 'PREPARING':
      return theme.color.bg.violetLight;
    case 'PREPARED':
      return theme.color.bg.violet;
    case 'INITIALIZING':
      return theme.color.bg.blueLight;
    case 'INITIALIZED':
      return theme.color.bg.blue;
    case 'RUNNING':
      return theme.color.bg.greenLight;
    case 'SUCCEEEDED':
      return theme.color.bg.green;
    case 'FAILED':
      return theme.color.bg.red;
    default:
      return theme.color.bg.dark;
  }
}
