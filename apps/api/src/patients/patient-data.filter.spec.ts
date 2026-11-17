import { ArgumentsHost, BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { PatientDataFilter } from './patient-data.filter';

describe('Errores sin información personal o clínica', () => {
  it.each([
    [new Error('documento y signos sensibles'), 500], [new BadRequestException('dato sensible'), 400],
    [new ServiceUnavailableException('clave sensible'), 503], [new HttpException('dato sensible', 422), 422],
  ])('elimina los detalles antes de responder', (error, status) => {
    const response = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
    const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      new PatientDataFilter().catch(error, host);
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(JSON.stringify(response.json.mock.calls)).not.toContain('sensible');
      expect(logger).not.toHaveBeenCalled();
    } finally { logger.mockRestore(); }
  });
});
