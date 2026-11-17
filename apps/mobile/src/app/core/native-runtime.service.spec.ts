import { TestBed } from '@angular/core/testing';

import { NativeRuntimeService } from './native-runtime.service';

const native = vi.hoisted(() => ({ platform: 'web', read: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => native.platform }, registerPlugin: () => native }));

describe('La excepción Android requiere confirmación nativa de debug', () => {
  it('web no habilita debug', async () => {
    native.platform = 'web';
    const service = TestBed.inject(NativeRuntimeService);
    await service.load();
    expect(service.debuggable).toBe(false);
  });
  it.each([true, false, 'true'])('acepta únicamente booleano true: %s', async (value) => {
    native.platform = 'android';
    native.read.mockResolvedValue({ debuggable: value });
    const service = TestBed.inject(NativeRuntimeService);
    await service.load();
    expect(service.debuggable).toBe(value === true);
  });
  it('falla cerrado cuando el plugin no responde', async () => {
    native.platform = 'android';
    native.read.mockRejectedValue(new Error('unavailable'));
    const service = TestBed.inject(NativeRuntimeService);
    await service.load();
    expect(service.debuggable).toBe(false);
  });
});
