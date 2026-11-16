import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/** Version 1: version (1 byte), IV (12), GCM tag (16), encrypted JSON. */
@Injectable()
export class PatientDataService {
  constructor(private readonly config: ConfigService) {}

  private keys(): { data: Buffer; hmac: Buffer } {
    const read = (name: string): Buffer => {
      const value = this.config.get<string>(name);
      if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
        throw new ServiceUnavailableException('Servicio de datos de pacientes no disponible');
      }
      const key = Buffer.from(value, 'base64');
      if (key.length !== 32 || key.toString('base64') !== value) {
        throw new ServiceUnavailableException('Servicio de datos de pacientes no disponible');
      }
      return key;
    };
    const data = read('PATIENT_DATA_KEY');
    const hmac = read('PATIENT_HMAC_KEY');
    if (data.equals(hmac)) {
      throw new ServiceUnavailableException('Servicio de datos de pacientes no disponible');
    }
    return { data, hmac };
  }

  documentHmac(document: string): string {
    // Preserve punctuation and leading zeros. The same normalization applies to registration/search.
    return createHmac('sha256', this.keys().hmac)
      .update(document.trim().toUpperCase(), 'utf8').digest('hex');
  }

  encrypt(value: unknown, context: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys().data, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
  }

  decrypt<T>(value: Buffer, context: string): T {
    const { data } = this.keys();
    if (value.length < 30 || value[0] !== 1) throw new Error('Datos protegidos no disponibles');
    const decipher = createDecipheriv('aes-256-gcm', data, value.subarray(1, 13), { authTagLength: 16 });
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(value.subarray(13, 29));
    return JSON.parse(Buffer.concat([decipher.update(value.subarray(29)), decipher.final()]).toString('utf8')) as T;
  }
}
