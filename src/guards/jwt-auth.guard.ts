import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { TokenService } from 'src/token/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log('Auth Header:', authHeader);
    if (!authHeader) {
      this.logger.warn('No authorization header found');
      throw new UnauthorizedException('Token de acesso é obrigatório');
    }

    const token = this.tokenService.extractTokenFromHeader(authHeader);
    if (!token) {
      this.logger.warn('Invalid authorization header format');
      throw new UnauthorizedException('Formato do token inválido');
    }

    try {
      // Valida o token JWT
      const payload = await this.tokenService.validateAccessToken(token);
      if (!payload) {
        throw new UnauthorizedException('Token inválido ou expirado');
      }

      // Verifica se o token existe no banco de dados
      const isValidInDb = await this.tokenService.verifyTokenInDatabase(
        payload.codUsu,
        token,
        'access',
      );

      if (!isValidInDb) {
        this.logger.warn(
          `Token not found in database for user: ${payload.codUsu}`,
        );
        throw new UnauthorizedException('Token não encontrado no sistema');
      }

      // Adiciona os dados do usuário à request
      request.user = payload;

      this.logger.log(`Authentication successful for user: ${payload.codUsu}`);
      return true;
    } catch (error) {
      this.logger.error('Authentication failed', error.message);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Falha na autenticação');
    }
  }
}
