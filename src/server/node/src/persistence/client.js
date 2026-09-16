import { promises as fs } from 'fs';
import path from 'path';

const keyDepth = 2;
const delimiter = '_';
const basePath = 'data/bdo';

const filePathForKey = async (key) => {
  let mutatingKey = key.replace(':', delimiter);
  const filePathParts = [];
  for(let i = 0; i < keyDepth; i++) {
    filePathParts.push(mutatingKey.slice(-3));
    mutatingKey = mutatingKey.slice(0, -3);
  }
  filePathParts.push(mutatingKey);
  filePathParts.push(basePath);

  const filePath = filePathParts.reverse().join('/');

  return filePath;
};

const set = async (key, value) => {
  const filePath = await filePathForKey(key);
  
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value);
  
  return true;
}

const get = async (key) => {
  const filePath = await filePathForKey(key);

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch(err) {
    return null;
  }
};

// Deleting a key that isn't there is a no-op, not an error — matching `get`
// above, which returns null rather than throwing, and matching how every
// key/value store behaves (Redis DEL on a missing key returns 0).
//
// fs.unlink throws ENOENT, which made any multi-key cleanup abort partway
// through the moment one key happened not to exist. deleteBDO hit this
// deleting a private BDO's non-existent public copy: the hash-keyed record
// was removed, then the throw skipped the emojicode and shortcode cleanup and
// surfaced to the caller as "not found" — a delete that half-succeeded and
// reported failure. deleteEmojicode had the same latent problem.
//
// Anything other than ENOENT still propagates; a permissions error or a full
// disk should not be silently swallowed.
const del = async (key) => {
  const filePath = await filePathForKey(key);

  try {
    await fs.unlink(filePath);
  } catch(err) {
    if(err.code !== 'ENOENT') {
      throw err;
    }
    return false;
  }

  return true;
};

const createClient = () => {
  return {
    on: () => createClient,
  };
};

createClient.connect = () => {
  return {
    set,
    get,
    del
  };
};

export { createClient };
