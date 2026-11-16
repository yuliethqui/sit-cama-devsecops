import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PatientDataService } from './patient-data.service';

describe('Protección de datos de pacientes', () => {
  const keys = { PATIENT_DATA_KEY: randomBytes(32).toString('base64'), PATIENT_HMAC_KEY: randomBytes(32).toString('base64') };
  const service = new PatientDataService(new ConfigService(keys));

  it('normaliza documento de forma consistente sin perder ceros o separadores', () => {
    expect(service.documentHmac(' abc-001 ')).toBe(service.documentHmac('ABC-001'));
    expect(service.documentHmac('001')).not.toBe(service.documentHmac('1'));
    expect(service.documentHmac('AB-001')).not.toBe(service.documentHmac('AB001'));
    expect(service.documentHmac('001')).toMatch(/^[a-f0-9]{64}$/);
    const other = new PatientDataService(new ConfigService({ ...keys, PATIENT_HMAC_KEY: randomBytes(32).toString('base64') }));
    expect(other.documentHmac('001')).not.toBe(service.documentHmac('001'));
  });

  it('cifra con IV aleatorio y autentica contexto y contenido', () => {
    const input = { document: 'DEMO-001', fullName: 'Persona Sintética' };
    const first = service.encrypt(input, 'identity:1');
    expect(first).not.toEqual(service.encrypt(input, 'identity:1'));
    expect(first.includes(Buffer.from(input.document))).toBe(false);
    expect(service.decrypt(first, 'identity:1')).toEqual(input);
    expect(() => service.decrypt(first, 'identity:2')).toThrow();
    const tampered = Buffer.from(first);
    tampered[tampered.length - 1] ^= 1;
    expect(() => service.decrypt(tampered, 'identity:1')).toThrow();
    const wrongKey = new PatientDataService(new ConfigService({ ...keys, PATIENT_DATA_KEY: randomBytes(32).toString('base64') }));
    expect(() => wrongKey.decrypt(first, 'identity:1')).toThrow();
  });

  it.each([Buffer.alloc(1), Buffer.alloc(40)])('rechaza formatos sin versión válida', value => {
    expect(() => service.decrypt(value, 'context')).toThrow('Datos protegidos no disponibles');
  });

  it.each([undefined, '', 'short', 'a'.repeat(43) + '=', Buffer.alloc(31).toString('base64')])('rechaza claves ausentes o inválidas', key => {
    const broken = new PatientDataService(new ConfigService({ ...keys, PATIENT_DATA_KEY: key }));
    expect(() => broken.encrypt({}, 'context')).toThrow('Servicio de datos de pacientes no disponible');
  });

  it('exige claves HMAC y AES independientes', () => {
    const broken = new PatientDataService(new ConfigService({ ...keys, PATIENT_HMAC_KEY: keys.PATIENT_DATA_KEY }));
    expect(() => broken.documentHmac('001')).toThrow('Servicio de datos de pacientes no disponible');
  });
});
