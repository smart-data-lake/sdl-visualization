import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify, Auth } from 'aws-amplify';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CenteredCircularProgress from '../components/Common/CenteredCircularProgress';
import { useManifest } from '../hooks/useManifest';
import DatabricksLogin from './DatabricksLogin';
import {
  completeLogin,
  currentAccessToken,
  hasAuthorizationCode,
  readSession,
  signOut as clearDatabricksSession,
  type DatabricksAuthConfig,
} from './databricksOAuth';
import { setAuthHeaderProvider } from './tokenProvider';
import { AuthHeaders, AuthSession } from './types';

/**
 * Which identity provider the deployment uses, decided by manifest.auth.type.
 *
 * "cognito" (the default, and what an existing manifest without a type means) is the
 * AWS Amplify flow the hosted deployment uses; "databricks" is the user-to-machine
 * OAuth flow against a Databricks workspace. Both produce the same AuthSession, so
 * nothing above this file knows which is configured.
 */

const AuthContext = React.createContext<AuthSession | undefined>(undefined);
AuthContext.displayName = 'AuthContext';

export function useAuth(): AuthSession {
  return React.useContext(AuthContext) ?? { status: 'unauthenticated' };
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const { data: manifest } = useManifest();
  const type = manifest?.auth?.type ?? 'cognito';

  /*
    The Databricks config gains the backend's base URL, which manifest.auth does not
    carry: the code is exchanged through the backend, because the workspace token
    endpoint sends no CORS headers (see redeem() in databricksOAuth.ts). It is taken
    from backendConfig - "bundled;<baseUrl>[;<repo>;<env>]" - rather than asked for a
    second time, so the two cannot disagree.

    Memoised because DatabricksAuthProvider keys an effect on this object; rebuilding
    it every render would restart the login on every render.
  */
  const databricksConfig = useMemo<DatabricksAuthConfig | undefined>(() => {
    if (!manifest?.auth) return undefined;
    const [kind, baseUrl] = (manifest.backendConfig ?? '').split(';');
    return {
      ...(manifest.auth as DatabricksAuthConfig),
      apiBaseUrl: kind === 'bundled' && baseUrl ? baseUrl.replace(/\/$/, '') : undefined,
    };
  }, [manifest]);

  if (type === 'databricks') {
    return <DatabricksAuthProvider config={databricksConfig!}>{children}</DatabricksAuthProvider>;
  }
  return <AmplifyAuthProvider config={manifest?.auth}>{children}</AmplifyAuthProvider>;
}

/* ------------------------------------------------------------------ Cognito */

function AmplifyAuthProvider({ config, children }: React.PropsWithChildren<{ config: any }>) {
  useEffect(() => {
    if (config) Amplify.configure(config);
  }, [config]);

  return (
    <Authenticator.Provider>
      <AmplifySession>{children}</AmplifySession>
    </Authenticator.Provider>
  );
}

function AmplifySession({ children }: React.PropsWithChildren) {
  const { user, signOut, authStatus } = useAuthenticator();

  useEffect(() => {
    // The ID token, with no Bearer prefix - what the existing hosted backend expects.
    setAuthHeaderProvider(async () => {
      const session = await Auth.currentSession();
      return { Authorization: session.getIdToken().getJwtToken() };
    });
    return () => setAuthHeaderProvider(undefined);
  }, []);

  const value = useMemo<AuthSession>(
    () => ({
      status:
        authStatus === 'authenticated'
          ? 'authenticated'
          : authStatus === 'configuring'
            ? 'configuring'
            : 'unauthenticated',
      userId: user?.attributes?.sub,
      email: user?.attributes?.email,
      loginElement: authStatus === 'authenticated' ? undefined : <Authenticator variation="modal" />,
      signOut: () => signOut(),
    }),
    [user, authStatus, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* --------------------------------------------------------------- Databricks */

function DatabricksAuthProvider({
  config,
  children,
}: React.PropsWithChildren<{ config: DatabricksAuthConfig }>) {
  const [status, setStatus] = useState<AuthSession['status']>('configuring');
  const [email, setEmail] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // A redirect coming back from the workspace has to be consumed before
        // anything else looks at the URL.
        if (hasAuthorizationCode()) {
          const session = await completeLogin(config);
          if (!cancelled) {
            setEmail(session.email);
            setStatus('authenticated');
          }
          return;
        }
        const session = await currentAccessToken(config);
        if (cancelled) return;
        setEmail(session?.email);
        setStatus(session ? 'authenticated' : 'unauthenticated');
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus('unauthenticated');
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [config]);

  useEffect(() => {
    setAuthHeaderProvider(async (): Promise<AuthHeaders> => {
      const session = await currentAccessToken(config);
      if (!session) {
        // The refresh token is gone; stop claiming to be signed in.
        setStatus('unauthenticated');
        return {};
      }
      return {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Databricks-Host': session.workspaceHost,
      };
    });
    return () => setAuthHeaderProvider(undefined);
  }, [config]);

  const signOut = useCallback(() => {
    clearDatabricksSession();
    setEmail(undefined);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthSession>(
    () => ({
      status,
      email,
      userId: email,
      /*
        Three states, not two. "configuring" is not "not signed in" - it is "not known
        yet", and it covers the whole of completeLogin(): a round trip to the backend,
        which makes its own round trip to the workspace, on an instance that may be
        cold starting. Showing the sign-in card through all of that told the user the
        login had failed and offered them a button that would start it over.
      */
      loginElement:
        status === 'authenticated' ? undefined : status === 'configuring' ? (
          <CenteredCircularProgress />
        ) : (
          <DatabricksLogin config={config} error={error} />
        ),
      signOut,
    }),
    [status, email, error, config, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { readSession };
