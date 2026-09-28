import { WebPubSubServiceClient } from '@azure/web-pubsub';
import type { LiveDriver } from '../index.js';
import { storageCredential } from '../../store/credential.js';

/**
 * Azure Web PubSub, reached with the app's managed identity (the "Web PubSub Service Owner" role).
 * The client token joins its group on connect, so the browser needs a plain WebSocket and sends nothing.
 */
export async function createWebPubSubDriver(endpoint: string, hub: string): Promise<LiveDriver> {
  const client = new WebPubSubServiceClient(endpoint, await storageCredential(), hub);
  return {
    async clientUrl(group, minutes) {
      const { url } = await client.getClientAccessToken({ groups: [group], expirationTimeInMinutes: minutes });
      return url;
    },
    async publish(group, message) {
      await client.group(group).sendToAll(message);
    },
  };
}
