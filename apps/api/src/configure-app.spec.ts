import { corsOrigins } from './configure-app';
describe('CORS explícito por entorno', () => {
  it('habilita localhost:8100 en desarrollo', () => {
    expect(corsOrigins({ NODE_ENV: 'development' })).toEqual(['http://localhost:8100']);
  });
  it('no habilita HTTP/localhost:8100 por defecto en producción', () => {
    expect(corsOrigins({ NODE_ENV: 'production' })).toEqual([]);
    expect(corsOrigins({ NODE_ENV: 'production', APP_ORIGIN: 'http://localhost:8100' })).toEqual([]);
  });
  it('acepta los dos orígenes del override de desarrollo y no un comodín', () => {
    expect(corsOrigins({ NODE_ENV: 'development', APP_ORIGIN: 'http://localhost:8100,https://localhost,*' }))
      .toEqual(['http://localhost:8100', 'https://localhost']);
  });
  it('permite solo orígenes HTTPS explícitos en producción, incluida la WebView', () => {
    expect(corsOrigins({ NODE_ENV: 'production', APP_ORIGIN: 'https://localhost,https://sitcama.example,https://sitcama.example,http://unsafe.test,*,https://bad.test/path' }))
      .toEqual(['https://localhost', 'https://sitcama.example']);
  });
});
