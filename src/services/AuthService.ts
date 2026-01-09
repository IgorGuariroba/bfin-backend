import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { ValidationError, UnauthorizedError } from '../middlewares/errorHandler';
import { RegisterDTO, LoginDTO, AuthResponse, JWTPayload } from '../types';

const prisma = new PrismaClient();

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET!;
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
    this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  /**
   * Registra um novo usuário
   */
  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Validar dados
    if (!data.email || !data.password || !data.full_name) {
      throw new ValidationError('Email, password and full name are required');
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validar senha (mínimo 6 caracteres)
    if (data.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    // Hash da senha
    const password_hash = await bcrypt.hash(data.password, 12);

    // Criar usuário e conta padrão em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // Criar usuário
      const user = await tx.user.create({
        data: {
          email: data.email,
          password_hash,
          full_name: data.full_name,
        },
      });

      // Criar conta padrão
      await tx.account.create({
        data: {
          user_id: user.id,
          account_name: 'Conta Principal',
          account_type: 'checking',
          is_default: true,
        },
      });

      // Criar regra de reserva de emergência para a conta
      const account = await tx.account.findFirst({
        where: { user_id: user.id, is_default: true },
      });

      if (account) {
        await tx.financialRule.create({
          data: {
            account_id: account.id,
            rule_type: 'emergency_reserve',
            rule_name: 'Reserva de Emergência Automática',
            percentage: 30,
            priority: 1,
            is_active: true,
          },
        });
      }

      return user;
    });

    // Gerar tokens
    const tokens = this.generateTokens({
      userId: result.id,
      email: result.email,
    });

    // Atualizar last_login
    await prisma.user.update({
      where: { id: result.id },
      data: { last_login: new Date() },
    });

    return {
      user: {
        id: result.id,
        email: result.email,
        full_name: result.full_name,
      },
      tokens,
    };
  }

  /**
   * Autentica um usuário
   */
  async login(data: LoginDTO): Promise<AuthResponse> {
    // Validar dados
    if (!data.email || !data.password) {
      throw new ValidationError('Email and password are required');
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verificar se usuário está ativo
    if (!user.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Gerar tokens
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
    });

    // Atualizar last_login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      tokens,
    };
  }

  /**
   * Refresh do token de acesso
   */
  async refreshToken(refresh_token: string): Promise<AuthResponse> {
    try {
      // Verificar refresh token
      const payload = jwt.verify(refresh_token, this.JWT_REFRESH_SECRET) as JWTPayload;

      // Buscar usuário
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.is_active) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Gerar novos tokens
      const tokens = this.generateTokens({
        userId: user.id,
        email: user.email,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
        },
        tokens,
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  /**
   * Busca informações do usuário autenticado
   */
  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        created_at: true,
        email_verified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return user;
  }

  /**
   * Gera access token e refresh token
   */
  private generateTokens(payload: JWTPayload) {
    const access_token = jwt.sign(
      payload,
      this.JWT_SECRET as Secret,
      { expiresIn: this.JWT_EXPIRES_IN } as SignOptions
    );

    const refresh_token = jwt.sign(
      payload,
      this.JWT_REFRESH_SECRET as Secret,
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN } as SignOptions
    );

    // Calcular expires_in em segundos
    const expires_in = this.parseExpiration(this.JWT_EXPIRES_IN);

    return {
      access_token,
      refresh_token,
      expires_in,
    };
  }

  /**
   * Converte string de expiração para segundos
   */
  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // 15 minutos padrão

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: { [key: string]: number } = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] || 60);
  }

  /**
   * Verifica se um token é válido
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
