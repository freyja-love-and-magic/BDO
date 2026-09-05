import sessionless from 'sessionless-node';
import { generateEmojicode } from '../utils/emojicoding.js';
import config from '../../config/local.js';

// esbuild's CJS output target (used by Netlify's function bundler) doesn't
// support top-level await, so the client is now a lazily-resolved promise -
// call sites now do `(await client).get(...)` instead of `client.get(...)`.
const client = (async () => {
  const { createClient } = process.env.PERSISTENCE_BACKEND === 'netlify-blobs'
    ? await import('./client.netlify-blobs.js')
    : await import('./client.js');

  return createClient()
    .on('error', err => console.log('Redis Client Error', err))
    .connect();
})();

const db = {
  getBDO: async (uuid, hash, pubKey) => {
console.log('getting: ', hash);
    const queryString = pubKey ? `bdo:${pubKey}` : `bdo:${uuid}_${hash}`;
console.log('should get bdo for: ', pubKey ? 'pubKey' : 'hash');
console.log(queryString);
    const bdo = await (await client).get(queryString);
console.log(bdo);
    const parsedBDO = JSON.parse(bdo);
    return parsedBDO;
  },

  putBDO: async (uuid, bdo, hash, pubKey) => {
console.log('putting', bdo, 'for', hash);
    const hashQueryString = `bdo:${uuid}_${hash}`;
    await (await client).set(hashQueryString, JSON.stringify(bdo));

    let emojiShortcode = null;

    if(pubKey) {
console.log('saving pubKey bdo for: ', `bdo:${pubKey}`);
      await (await client).set(`bdo:${pubKey}`, JSON.stringify(bdo));

      // Generate and save emoji shortcode for public BDOs (8-emoji code)
      emojiShortcode = await (await client).get(`emojicode:code:${pubKey}`);
      if (!emojiShortcode) {
        try {
          // Generate emoji shortcode with collision checking
          emojiShortcode = await generateEmojicode(
            config.baseEmoji,
            async (code) => await db.checkEmojicodeExists(code)
          );

          // Save the mapping with timestamp
          await db.saveEmojicodeMapping(pubKey, emojiShortcode);
console.log(`assigned emoji shortcode ${emojiShortcode} to pubKey ${pubKey}`);
        } catch (error) {
console.error(`Failed to generate emoji shortcode for pubKey ${pubKey}:`, error);
        }
      }
    }

    return { bdo, emojiShortcode };
  },

  getBases: async () => {
    const basesString = (await (await client).get(`allyabases`)) || '{}';
    const bases = JSON.parse(basesString);

    return bases;
  },

  putBases: async (newBases) => {
    if(!newBases) {
      throw new Error('malformed bases');
    }
    const basesString = (await (await client).get('allyabases')) || '{}';
    const bases = JSON.parse(basesString);
    const updatedBases = {...bases, ...newBases};
    await (await client).set(`allyabases`, JSON.stringify(updatedBases));

    return updatedBases;
  },

  getSpellbooks: async () => {
    const spellbooksString = (await (await client).get(`spellbooks`)) || '[]';
    const spellbooks = JSON.parse(spellbooksString);

    return spellbooks;
  },

  putSpellbook: async (spellbook) => {
    if(!spellbook || !spellbook.spellbookName) {
      throw new Error('malformed spellbok');
    }
    const spellbooksString = (await (await client).get('spellbooks')) || '[]';
    const spellbooks = JSON.parse(spellbooksString);
    spellbooks.push(spellbook);
    await (await client).set(`spellbooks`, JSON.stringify(spellbooks));

    return spellbooks;
  },

  deleteBDO: async (uuid, hash) => {
    const resp = await (await client).del(`bdo:${uuid}_${hash}`);

    return true;
  },

  saveKeys: async (keys) => {
    await (await client).set(`keys`, JSON.stringify(keys));
  },

  getKeys: async () => {
    const keyString = await (await client).get('keys');
    return JSON.parse(keyString);
  },

  // Short code functionality for public BDOs
  getNextShortCode: async () => {
    const currentCounter = await (await client).get('shortcode:counter') || '0';
    const nextCounter = parseInt(currentCounter) + 1;
    await (await client).set('shortcode:counter', nextCounter.toString());

    // Convert to 36-bit hex (9 hex characters max for 36 bits)
    const shortCode = nextCounter.toString(16).padStart(9, '0');
    return shortCode;
  },

  saveShortCodeMapping: async (pubKey, shortCode) => {
    // Save bidirectional mapping
    await (await client).set(`shortcode:pubkey:${shortCode}`, pubKey);
    await (await client).set(`shortcode:code:${pubKey}`, shortCode);
  },

  getShortCodeForPubKey: async (pubKey) => {
    return await (await client).get(`shortcode:code:${pubKey}`);
  },

  getPubKeyForShortCode: async (shortCode) => {
    return await (await client).get(`shortcode:pubkey:${shortCode}`);
  },

  // Emojicode functionality for BDOs
  checkEmojicodeExists: async (emojicode) => {
    const exists = await (await client).get(`emojicode:pubkey:${emojicode}`);
    return exists !== null;
  },

  saveEmojicodeMapping: async (pubKey, emojicode) => {
    const timestamp = Date.now();

    // Save bidirectional mapping
    await (await client).set(`emojicode:pubkey:${emojicode}`, pubKey);
    await (await client).set(`emojicode:code:${pubKey}`, emojicode);

    // Save creation timestamp for pruning
    await (await client).set(`emojicode:created:${emojicode}`, timestamp.toString());

    console.log(`Saved emojicode ${emojicode} for pubKey ${pubKey} at ${timestamp}`);
  },

  getEmojicodeForPubKey: async (pubKey) => {
    return await (await client).get(`emojicode:code:${pubKey}`);
  },

  getPubKeyForEmojicode: async (emojicode) => {
    return await (await client).get(`emojicode:pubkey:${emojicode}`);
  },

  getEmojicodeCreationTime: async (emojicode) => {
    const timestamp = await (await client).get(`emojicode:created:${emojicode}`);
    return timestamp ? parseInt(timestamp) : null;
  },

  deleteEmojicode: async (emojicode) => {
    const pubKey = await (await client).get(`emojicode:pubkey:${emojicode}`);
    if (pubKey) {
      await (await client).del(`emojicode:code:${pubKey}`);
    }
    await (await client).del(`emojicode:pubkey:${emojicode}`);
    await (await client).del(`emojicode:created:${emojicode}`);
    console.log(`Deleted emojicode ${emojicode}`);
  }

};

export default db;
