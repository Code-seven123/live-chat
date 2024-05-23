import crypto from "crypto"
import fs from "fs"
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function hashPass(password){
  const salt = Buffer.from(fs.readFileSync(join(__dirname, "../salt.txt"))).toString("base64")
  const iterations = 10000;
  const keylen = 64;
  const digest = "sha512"
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    keylen,
    digest
  ).toString("base64")
  return hash
}

function verifHash(password, hash){
  const newHash = hashPass(password)
  return hash == newHash
}

export {
  hashPass,
  verifHash
}
