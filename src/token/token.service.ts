import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

export interface TokenPayload {
  codUsu: number;
  email: string;
  nomeUsu: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Gera um par de tokens (access e refresh) para o usuário
   */
  async generateTokens(payload: TokenPayload): Promise<TokenPair> {
    try {
      this.logger.log(`Generating tokens for user: ${payload.codUsu}`);

      const accessTokenPayload = {
        codUsu: payload.codUsu,
        email: payload.email,
        nomeUsu: payload.nomeUsu,
      };

      const refreshTokenPayload = {
        codUsu: payload.codUsu,
        type: 'refresh',
      };

      // Gera access token (15 minutos)
      const accessToken = this.jwtService.sign(accessTokenPayload, {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'access-secret-key',
        expiresIn:
          this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m',
      });

      // Gera refresh token (7 dias)
      const refreshToken = this.jwtService.sign(refreshTokenPayload, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'refresh-secret-key',
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      });

      const expiresIn = 15 * 60; // 15 minutos em segundos

      return {
        accessToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate tokens for user: ${payload.codUsu}`,
        error,
      );
      throw new Error('Falha ao gerar tokens');
    }
  }

  /**
   * Gera apenas um novo access token
   */
  private async generateAccessToken(payload: TokenPayload): Promise<string> {
    try {
      const accessTokenPayload = {
        codUsu: payload.codUsu,
        email: payload.email,
        nomeUsu: payload.nomeUsu,
      };

      const accessToken = this.jwtService.sign(accessTokenPayload, {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'access-secret-key',
        expiresIn:
          this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m',
      });

      return accessToken;
    } catch (error) {
      this.logger.error(
        `Failed to generate access token for user: ${payload.codUsu}`,
        error,
      );
      throw new Error('Falha ao gerar access token');
    }
  }

  /**
   * Salva os tokens no banco de dados usando SpGrToken
   */
  async saveTokensToDatabase(codUsu: number, tokens: TokenPair): Promise<void> {
    try {
      this.logger.log(`Saving tokens to database for user: ${codUsu}`);

      const query = `
        DECLARE @CodUsu int = ${codUsu};
        DECLARE @AccessToken nvarchar(max) = '${tokens.accessToken.replace(/'/g, "''")}';
        DECLARE @ResetToken nvarchar(max) = '${tokens.refreshToken.replace(/'/g, "''")}';
        
        EXEC SpGrToken @CodUsu, @AccessToken, @ResetToken
      `;

      this.logger.log(`Executing SpGrToken for user: ${codUsu}`);

      await this.databaseService.executeQuery(query, []);

      this.logger.log(`Tokens saved successfully for user: ${codUsu}`);
    } catch (error) {
      this.logger.error(`Failed to save tokens for user: ${codUsu}`, error);
      throw new Error('Falha ao salvar tokens no banco de dados');
    }
  }

  /**
   * Atualiza tokens no banco usando SpGrToken (usado no refresh)
   */
  private async updateTokensInDatabase(
    codUser: number,
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    try {
      this.logger.log(`Updating tokens in database for user: ${codUser}`);

      const query = `
        DECLARE @CodUser int = ${codUser};
        DECLARE @AccessToken nvarchar(max) = '${accessToken.replace(/'/g, "''")}';
        DECLARE @ResetToken nvarchar(max) = '${refreshToken.replace(/'/g, "''")}';
        
        EXEC SpGrToken @CodUser, @AccessToken, @ResetToken
      `;

      this.logger.log(`Executing SpGrToken for token refresh: ${codUser}`);

      await this.databaseService.executeQuery(query, []);

      this.logger.log(`Tokens updated successfully for user: ${codUser}`);
    } catch (error) {
      this.logger.error(`Failed to update tokens for user: ${codUser}`, error);
      throw new Error('Falha ao atualizar tokens no banco de dados');
    }
  }

  /**
   * Valida o access token
   */
  async validateAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'access-secret-key',
      });

      return payload;
    } catch (error) {
      this.logger.warn('Invalid access token', error.message);
      return null;
    }
  }

  /**
   * Valida o refresh token
   */
  async validateRefreshToken(
    token: string,
  ): Promise<{ codUsu: number } | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'refresh-secret-key',
      });

      if (payload.type !== 'refresh') {
        return null;
      }

      return { codUsu: payload.codUsu };
    } catch (error) {
      this.logger.warn('Invalid refresh token', error.message);
      return null;
    }
  }

  /**
   * Verifica se o token salvo no banco bate com o fornecido usando SpSe1Usuario
   */
  async verifyTokenInDatabase(
    codUsu: number,
    token: string,
    tokenType: 'access' | 'refresh',
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Verifying ${tokenType} token in database for user: ${codUsu}`,
      );

      const query = `
        DECLARE @CodUsu int = ${codUsu};
        
        EXEC SpSe1Usuario @CodUsu
      `;

      const result = await this.databaseService.executeQuery(query, []);

      if (!result || result.length === 0) {
        this.logger.warn(
          `User not found in database for token verification: ${codUsu}`,
        );
        return false;
      }

      const user = result[0];
      const tokenColumn = tokenType === 'access' ? 'AccessToken' : 'ResetToken';
      const storedToken = user[tokenColumn];

      if (!storedToken) {
        this.logger.warn(`No ${tokenType} token stored for user: ${codUsu}`);
        return false;
      }

      const tokenMatch = storedToken === token;

      this.logger.log(
        `Token verification for user ${codUsu}: ${tokenMatch ? 'MATCH' : 'NO MATCH'}`,
      );

      return tokenMatch;
    } catch (error) {
      this.logger.error(
        `Failed to verify token in database for user: ${codUsu}`,
        error,
      );
      return false;
    }
  }

  /**
   * Refresh tokens - renova access token mantendo o refresh token
   */
  async refreshTokens(
    refreshToken: string,
    codUser: number,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } | null> {
    try {
      this.logger.log(`Refresh tokens attempt for user: ${codUser}`);

      // Valida refresh token
      const payload = await this.validateRefreshToken(refreshToken);
      if (!payload) {
        this.logger.warn(`Invalid refresh token for user: ${codUser}`);
        // Remove tokens inválidos do banco (logout)
        await this.revokeTokens(codUser);
        return null;
      }

      // Verifica se o codUser do token bate com o fornecido
      if (payload.codUsu !== codUser) {
        this.logger.warn(
          `Token codUser mismatch: expected ${codUser}, got ${payload.codUsu}`,
        );
        // Remove tokens inválidos do banco (logout)
        await this.revokeTokens(codUser);
        return null;
      }

      // Verifica se o refresh token existe no banco
      const isValidInDb = await this.verifyTokenInDatabase(
        codUser,
        refreshToken,
        'refresh',
      );
      if (!isValidInDb) {
        this.logger.warn(
          `Refresh token not found in database for user: ${codUser}`,
        );
        // Remove tokens inválidos do banco (logout)
        await this.revokeTokens(codUser);
        return null;
      }

      // Busca dados do usuário usando SpSeUsuario
      const user = await this.getUserDataByCodUsu(codUser);

      if (!user) {
        this.logger.warn(`User not found for refresh token: ${codUser}`);
        // Remove tokens do usuário que não existe mais
        await this.revokeTokens(codUser);
        return null;
      }

      // Gera apenas um novo ACCESS TOKEN (refresh token é mantido)
      const newAccessToken = await this.generateAccessToken({
        codUsu: user.codUsu,
        email: user.email,
        nomeUsu: user.nomeUsu,
      });

      // Atualiza tokens no banco usando SpGrToken
      await this.updateTokensInDatabase(codUser, newAccessToken, refreshToken);

      const expiresIn = 15 * 60; // 15 minutos em segundos

      this.logger.log(`Tokens refreshed successfully for user: ${codUser}`);

      return {
        accessToken: newAccessToken,
        refreshToken: refreshToken, // Mantém o mesmo refresh token
        expiresIn,
      };
    } catch (error) {
      this.logger.error(`Failed to refresh tokens for user: ${codUser}`, error);
      // Em caso de erro, remove tokens para forçar novo login
      try {
        await this.revokeTokens(codUser);
      } catch (revokeError) {
        this.logger.error(
          `Failed to revoke tokens during error handling: ${codUser}`,
          revokeError,
        );
      }
      return null;
    }
  }

  /**
   * Busca dados do usuário por CodUsu usando SpSeUsuario
   */
  private async getUserDataByCodUsu(codUsu: number): Promise<{
    codUsu: number;
    nomeUsu: string;
    email: string;
  } | null> {
    try {
      this.logger.log(`Getting user data for CodUsu: ${codUsu}`);

      const query = `
        DECLARE @NomeUsu varchar(100) = '';
        
        EXEC SpSeUsuario @NomeUsu
      `;

      const result = await this.databaseService.executeQuery(query, []);

      if (result && Array.isArray(result)) {
        // Procura pelo usuário com o CodUsu específico
        const userFound = result.find((user) => user.CodUsu === codUsu);

        if (userFound) {
          return {
            codUsu: userFound.CodUsu,
            nomeUsu: userFound.NomeUsu?.trim() || '',
            email: userFound.Email?.trim() || '',
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get user data for CodUsu: ${codUsu}`, error);
      return null;
    }
  }

  /**
   * Remove os tokens do usuário (logout) usando SpGrToken
   */
  async revokeTokens(codUsu: number): Promise<void> {
    try {
      this.logger.log(`Revoking tokens for user: ${codUsu}`);

      const query = `
        DECLARE @CodUsu int = ${codUsu};
        
        EXEC SpGrToken @CodUsu, NULL, NULL
      `;

      await this.databaseService.executeQuery(query, []);

      this.logger.log(`Tokens revoked successfully for user: ${codUsu}`);
    } catch (error) {
      this.logger.error(`Failed to revoke tokens for user: ${codUsu}`, error);
      throw new Error('Falha ao revogar tokens');
    }
  }

  /**
   * Extrai token do header Authorization
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
