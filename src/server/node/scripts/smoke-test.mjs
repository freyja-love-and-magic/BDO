import { BlobsServer } from '@netlify/blobs/server';

const port = Number(process.env.BLOBS_LOCAL_PORT) || 8999;
const token = process.env.BLOBS_LOCAL_TOKEN || 'local-dev-token';
const directory = process.env.BLOBS_LOCAL_DIR || 'data/netlify-blobs';

const server = new BlobsServer({ directory, port, token });
await server.start();

process.env.BLOBS_LOCAL_URL = `http://localhost:${port}`;
process.env.BLOBS_LOCAL_TOKEN = token;

const { createClient } = await import('../src/persistence/client.netlify-blobs.js');

const client = await createClient().on('error', () => {}).connect();

console.log('SET bdo:test_hash ->', await client.set('bdo:test_hash', JSON.stringify({ hello: 'world' })));
console.log('GET bdo:test_hash ->', await client.get('bdo:test_hash'));
console.log('GET bdo:missing_key ->', await client.get('bdo:missing_key'));
console.log('DEL bdo:test_hash ->', await client.del('bdo:test_hash'));
console.log('GET after DEL ->', await client.get('bdo:test_hash'));

await server.stop();
process.exit(0);
