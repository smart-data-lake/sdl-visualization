import { Theme } from '@aws-amplify/ui-react';

/**
 * SDL brand blue. The app's UI colours come from the MUI Joy theme; this constant exists only
 * because AWS Amplify's auth widgets need their palette handed over in Amplify's own format.
 */
const BRAND_BLUE = '#096bde';

export const amplifyTheme: Theme = {
  name: "SDL",
  tokens: {
    colors: {
      brand: {
        primary: {
          "10": "#e6eef7",
          "20": "#dbeaf9",
          "80": BRAND_BLUE,
          "90": "#0b488f",
          "100": BRAND_BLUE,
        }
      }
    }
  },
}
