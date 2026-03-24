import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const BLOCK_SIZE = 32;

@Injectable()
export class WecomCryptoService {
  /**
   * Derive AES key and IV from EncodingAESKey.
   * EncodingAESKey is a 43-char Base64 string; appending '=' makes it 44 chars,
   * which decodes to 32 bytes (AES-256).
   */
  private getKeyAndIv(encodingAESKey: string): { key: Buffer; iv: Buffer } {
    const key = Buffer.from(encodingAESKey + '=', 'base64');
    const iv = key.subarray(0, 16);
    return { key, iv };
  }

  /**
   * Calculate WeCom callback signature.
   * signature = SHA1( sort([token, timestamp, nonce, encrypt]) )
   */
  calculateSignature(
    token: string,
    timestamp: string,
    nonce: string,
    encrypt: string,
  ): string {
    const items = [token, timestamp, nonce, encrypt].sort();
    return crypto.createHash('sha1').update(items.join('')).digest('hex');
  }

  /**
   * Decrypt an AES-encrypted WeCom message.
   * Plaintext layout: 16 random bytes | 4 bytes msg length (big-endian) | message | corpId
   */
  decrypt(encodingAESKey: string, encryptedMsg: string): string {
    const { key, iv } = this.getKeyAndIv(encodingAESKey);
    const encrypted = Buffer.from(encryptedMsg, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    // Remove PKCS7 padding
    const padLen = decrypted[decrypted.length - 1];
    const content = decrypted.subarray(0, decrypted.length - padLen);

    // Skip the 16 random-bytes prefix
    const msgLen = content.readUInt32BE(16);
    const message = content.subarray(20, 20 + msgLen).toString('utf-8');
    return message;
  }

  /**
   * Encrypt a reply message (for cases that require encrypted responses).
   * Plaintext layout: 16 random bytes | 4 bytes msg length (big-endian) | message | corpId
   */
  encrypt(encodingAESKey: string, message: string, corpId: string): string {
    const { key, iv } = this.getKeyAndIv(encodingAESKey);

    const random = crypto.randomBytes(16);
    const msgBuffer = Buffer.from(message, 'utf-8');
    const lenBuffer = Buffer.allocUnsafe(4);
    lenBuffer.writeUInt32BE(msgBuffer.length, 0);
    const corpIdBuffer = Buffer.from(corpId, 'utf-8');

    const plaintext = Buffer.concat([
      random,
      lenBuffer,
      msgBuffer,
      corpIdBuffer,
    ]);

    // PKCS7 padding to BLOCK_SIZE
    const amountToPad = BLOCK_SIZE - (plaintext.length % BLOCK_SIZE);
    const pad = Buffer.alloc(amountToPad, amountToPad);
    const padded = Buffer.concat([plaintext, pad]);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
    return encrypted.toString('base64');
  }

  /**
   * Build an encrypted XML response payload as required by WeCom.
   */
  buildEncryptedReply(
    encodingAESKey: string,
    token: string,
    corpId: string,
    replyMsg: string,
  ): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(8).toString('hex');
    const encrypt = this.encrypt(encodingAESKey, replyMsg, corpId);
    const signature = this.calculateSignature(token, timestamp, nonce, encrypt);

    return [
      '<xml>',
      `<Encrypt><![CDATA[${encrypt}]]></Encrypt>`,
      `<MsgSignature><![CDATA[${signature}]]></MsgSignature>`,
      `<TimeStamp>${timestamp}</TimeStamp>`,
      `<Nonce><![CDATA[${nonce}]]></Nonce>`,
      '</xml>',
    ].join('');
  }
}
