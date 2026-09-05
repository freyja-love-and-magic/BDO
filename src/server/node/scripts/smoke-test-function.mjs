import { BlobsServer } from '@netlify/blobs/server';

const port = Number(process.env.BLOBS_LOCAL_PORT) || 9000;
const token = process.env.BLOBS_LOCAL_TOKEN || 'local-dev-token';
const directory = process.env.BLOBS_LOCAL_DIR || 'data/netlify-blobs';

const server = new BlobsServer({ directory, port, token });
await server.start();

process.env.BLOBS_LOCAL_URL = `http://localhost:${port}`;
process.env.BLOBS_LOCAL_TOKEN = token;
process.env.PERSISTENCE_BACKEND = 'netlify-blobs';
process.env.LOCALHOST = 'true';

// Netlify sets NETLIFY_BLOBS_CONTEXT itself via connectLambda(event) inside the
// handler - we're simulating that path here, not the real Netlify context, so
// client.netlify-blobs.js should fall through to the BLOBS_LOCAL_* branch.
const { handler } = await import('../netlify/functions/bdo.js');

const fakeEvent = {
  httpMethod: 'GET',
  path: '/pubkey/does-not-exist-pubkey/emojicode',
  headers: {},
  queryStringParameters: { timestamp: String(Date.now()) },
  body: null,
  isBase64Encoded: false,
};

const response = await handler(fakeEvent, {});

console.log('statusCode:', response.statusCode);
console.log('body:', response.body);

await server.stop();
process.exit(0);
