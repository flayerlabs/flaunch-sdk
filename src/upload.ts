/**
 * Uploads go through the Flaunch web2 API, which moderates and pins them to IPFS.
 * `baseUrl` is the API origin, for example `https://web2-api.v3.flaunch.gg`.
 */

/** Pins an image (jpeg, png, gif or webp, up to 10 MB) and returns its CID. */
export async function uploadImage(baseUrl: string, image: Blob): Promise<string> {
  const body = new FormData();
  body.append("file", image);
  return post(`${baseUrl}/v1/upload/image`, { method: "POST", body });
}

/** Pins coin metadata (ERC-7572 fields, with an `ipfs://` image) and returns its CID. Use `ipfs://<cid>` as the contract URI. */
export async function uploadMetadata(baseUrl: string, metadata: Record<string, unknown>): Promise<string> {
  return post(`${baseUrl}/v1/upload/metadata`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(metadata),
  });
}

async function post(url: string, init: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Upload failed with ${response.status}: ${await response.text()}`);
  const { cid } = (await response.json()) as { cid: string };
  return cid;
}
