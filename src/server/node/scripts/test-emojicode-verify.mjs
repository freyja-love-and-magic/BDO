import sessionless from 'sessionless-node';

const BDO_URL = 'https://allyabase-gateway.netlify.app/bdo';

async function runOnce(label, waitBeforeCheckMs) {
  let keys = null;
  await sessionless.generateKeys((k) => { keys = k; }, () => keys);

  const createTimestamp = Date.now().toString();
  const hash = 'test-hash';
  const createPayload = {
    timestamp: createTimestamp,
    pubKey: keys.pubKey,
    hash,
    bdo: { hello: 'world' },
    signature: await sessionless.sign(createTimestamp + keys.pubKey + hash),
  };
  const createRes = await fetch(`${BDO_URL}/user/create`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  });
  const createBody = await createRes.json();
  const uuid = createBody.uuid;

  const updateTimestamp = Date.now().toString();
  const updatePayload = {
    timestamp: updateTimestamp,
    uuid,
    hash,
    bdo: { hello: 'world', updated: true },
    public: true,
    pubKey: keys.pubKey,
    signature: await sessionless.sign(updateTimestamp + uuid + hash),
  };
  const updateRes = await fetch(`${BDO_URL}/user/${uuid}/bdo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload),
  });
  const updateBody = await updateRes.json();

  console.log(`[${label}] updateBDO response emojiShortcode:`, updateBody.emojiShortcode);

  if (waitBeforeCheckMs > 0) {
    console.log(`[${label}] waiting ${waitBeforeCheckMs}ms before separate GET check...`);
    await new Promise(r => setTimeout(r, waitBeforeCheckMs));
  }

  const checkRes = await fetch(`${BDO_URL}/pubkey/${keys.pubKey}/emojicode`);
  const checkBody = await checkRes.json();
  console.log(`[${label}] separate GET /pubkey/:pubKey/emojicode ->`, checkRes.status, JSON.stringify(checkBody));
  console.log('');
}

await runOnce('immediate check', 0);
await runOnce('5s wait', 5000);
await runOnce('65s wait', 65000);
