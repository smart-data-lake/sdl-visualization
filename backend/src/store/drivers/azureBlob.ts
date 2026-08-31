import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import type { BlobInfo, BlobStore } from '../blobs.js';
import type { AzureStorageAuth } from '../../config.js';
import { blobEndpoint, storageCredential } from '../credential.js';
import { DEFAULT_CONTENT_TYPE } from '../contentType.js';

/**
 * The Azure Blob Storage driver.
 *
 * Block blobs, whole buffers in and out. uploadData on a blob under 256 MB is a single
 * atomic PUT, so a concurrent reader sees the old body or the new one and never a
 * partial write - which patchState depends on, since SDLB sends one PATCH per action
 * while a run is in flight. A driver on something without that property has to arrange
 * it for itself.
 */
export interface AzureBlobOptions {
  storage: AzureStorageAuth;
  container: string;
}

export function createAzureBlobStore(options: AzureBlobOptions): BlobStore {
  let container: Promise<ContainerClient> | undefined;

  /** Memoised: the container is created on first use, and @azure/identity loads lazily. */
  function containerClient(): Promise<ContainerClient> {
    if (!container) container = build();
    return container;
  }

  async function build(): Promise<ContainerClient> {
    const { storage } = options;
    const service =
      storage.kind === 'identity'
        ? new BlobServiceClient(blobEndpoint(storage.accountName), await storageCredential(), {
            retryOptions: { maxTries: 3 },
          })
        : // No allowInsecureConnection here, unlike the table client: @azure/storage-blob
          // builds its own pipeline with no https guard and takes the scheme from the
          // connection string's BlobEndpoint, so Azurite's http works as-is.
          BlobServiceClient.fromConnectionString(storage.value, {
            retryOptions: { maxTries: 3 },
          });

    const client = service.getContainerClient(options.container);
    await client.createIfNotExists();
    return client;
  }

  const blob = async (path: string) => (await containerClient()).getBlockBlobClient(path);

  return {
    async writeBuffer(path: string, body: Buffer, contentType: string): Promise<void> {
      await (await blob(path)).uploadData(body, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
    },

    async readBuffer(path: string): Promise<Buffer | undefined> {
      try {
        return await (await blob(path)).downloadToBuffer();
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },

    async list(pathPrefix: string): Promise<BlobInfo[]> {
      const client = await containerClient();
      const results: BlobInfo[] = [];
      // A string prefix, which is what the interface promises: this matches
      // "a/b/prefix.md" for the prefix "a/b/pre".
      for await (const item of client.listBlobsFlat({ prefix: pathPrefix })) {
        results.push({
          name: item.name.slice(pathPrefix.length),
          contentType: item.properties.contentType ?? DEFAULT_CONTENT_TYPE,
          size: item.properties.contentLength ?? 0,
          lastModified: item.properties.lastModified ?? new Date(0),
        });
      }
      return results;
    },

    async remove(path: string): Promise<boolean> {
      return (await (await blob(path)).deleteIfExists()).succeeded;
    },
  };
}

function isNotFound(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404;
}
