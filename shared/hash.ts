import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export const digestString = (input: string): string => bytesToHex(sha256(utf8ToBytes(input)));
