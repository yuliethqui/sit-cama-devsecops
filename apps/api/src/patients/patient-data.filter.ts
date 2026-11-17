import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

/** Do not pass database errors (which may contain values) to Nest's exception logger. */
@Catch()
export class PatientDataFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    response.setHeader('Cache-Control', 'no-store');
    const messages: Record<number, string> = {
      400: 'Datos de entrada inválidos', 401: 'Autenticación requerida', 403: 'Rol no autorizado',
      404: 'Recurso no encontrado', 409: 'Conflicto con el estado actual',
      413: 'Solicitud demasiado grande', 415: 'Tipo de contenido no admitido',
      503: 'Servicio de datos de pacientes no disponible',
    };
    response.status(status).json({
      statusCode: status,
      message: messages[status] ?? 'No fue posible procesar la solicitud',
    });
  }
}
