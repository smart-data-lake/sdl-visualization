import { Alert, Box, Button, Card, Option, Select, Typography } from '@mui/joy';
import { useEffect, useState } from 'react';
import { beginLogin, type DatabricksAuthConfig } from './databricksOAuth';

/**
 * The sign-in screen for the Databricks flow.
 *
 * The workspace is the authorization server, so the user has to say which one
 * before there is anywhere to send them. With a single configured workspace there
 * is nothing to choose and the select is not shown.
 */
export default function DatabricksLogin({
  config,
  error,
}: {
  config: DatabricksAuthConfig;
  error?: string;
}) {
  const hosts = config.workspaceHosts ?? [];
  const [host, setHost] = useState<string>(hosts[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(error);

  /*
    The provider's error has to be followed, not just read once.

    App.tsx renders this component as soon as nobody is authenticated, which is
    before the provider has finished looking at the URL - and an error coming back
    from the workspace (`?error=access_denied&error_description=...`) is produced by
    that async effect, so it always arrives after this component has mounted. Passing
    it as useState's initial value therefore captured `undefined` every time, and the
    reason a login was refused was parsed, thrown, caught, stored - and never shown.
  */
  useEffect(() => setFailure(error), [error]);

  const signIn = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      await beginLogin(config, host);
    } catch (caught) {
      setBusy(false);
      setFailure(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 2 }}>
      <Card variant="outlined" sx={{ maxWidth: 480, width: '100%', gap: 2, p: 3 }}>
        <Typography level="h3">Sign in</Typography>
        <Typography level="body-sm">
          This viewer uses your Databricks account. You will be sent to your workspace to sign in,
          and you will see the repositories and environments that workspace has access to.
        </Typography>

        {failure && (
          <Alert color="danger" variant="soft">
            {failure}
          </Alert>
        )}

        {hosts.length === 0 ? (
          <Alert color="warning" variant="soft">
            No Databricks workspace is configured. Set <code>auth.workspaceHosts</code> in
            <code> manifest.json</code>.
          </Alert>
        ) : (
          <>
            {hosts.length > 1 && (
              <Select value={host} onChange={(_, value) => setHost(value as string)}>
                {hosts.map((option) => (
                  <Option key={option} value={option}>
                    {option.replace('https://', '')}
                  </Option>
                ))}
              </Select>
            )}
            <Button onClick={signIn} loading={busy} disabled={!host}>
              Continue with Databricks
            </Button>
          </>
        )}
      </Card>
    </Box>
  );
}
