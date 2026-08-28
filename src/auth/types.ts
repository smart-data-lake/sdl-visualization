import React from 'react';

/**
 * What the app needs from an identity provider, independent of which one is configured.
 *
 * The app used to talk to AWS Amplify directly from three places - Amplify.configure
 * in App.tsx, useAuthenticator in useUser, and the authStatus gate in useFetchData -
 * which meant a second provider could not exist beside it. Those three now go
 * through this shape instead, and Amplify is one implementation of it.
 */
export interface AuthSession {
  status: 'configuring' | 'authenticated' | 'unauthenticated';
  userId?: string;
  email?: string;
  /** Rendered in place of the whole app while the user is not signed in. */
  loginElement?: React.ReactElement;
  signOut?: () => void;
}

/**
 * How a request is authenticated, kept apart from AuthSession because the fetchAPI
 * implementations are plain classes and cannot use React hooks.
 */
export interface AuthHeaders {
  [name: string]: string;
}
