import sessionless from 'sessionless-node';

const BDO_URL = 'https://allyabase-gateway.netlify.app/bdo';

let keys = null;
await sessionless.generateKeys((k) => { keys = k; }, () => keys);

// Step 1: createUser (bdo-js's createUser payload shape, no public flag - matches real client)
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
console.log('createUser ->', createRes.status, JSON.stringify(createBody));

const uuid = createBody.uuid;

// Step 2: updateBDO with pub=true (bdo-js's updateBDO payload shape - this is the real path to an emojicode)
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
console.log('updateBDO(pub=true) ->', updateRes.status, JSON.stringify(updateBody));
