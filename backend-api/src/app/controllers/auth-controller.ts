import { FastifyRequest, FastifyReply } from 'fastify';
import { RegisterUser } from '../../domain/use-cases/auth/RegisterUser';
import { LoginUser } from '../../domain/use-cases/auth/LoginUser';
import { RegisterSchema, LoginSchema } from '../../domain/entities/Auth';
import { DomainError } from '../../domain/errors/DomainError';

export class AuthController {
  constructor(
    private registerUser: RegisterUser,
    private loginUser: LoginUser
  ) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userData = RegisterSchema.parse(request.body);
      
      const result = await this.registerUser.execute(userData);
      
      if (result.success) {
        const user = result.data;
        const token = this.generateToken(user.id, user.email);
        
        return reply.status(201).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          token,
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, password } = LoginSchema.parse(request.body);
      
      const result = await this.loginUser.execute(email, password);
      
      if (result.success) {
        const user = result.data;
        const token = this.generateToken(user.id, user.email);
        
        return reply.send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          token,
        });
      } else {
        return this.handleError(reply, result.error);
      }
    } catch (error) {
      return this.handleValidationError(reply, error);
    }
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    // In v0.1, we'll just return a new token
    // In production, implement proper refresh token logic
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    }

    const token = this.generateToken(user.id, user.email);
    return reply.send({ token });
  }

  async logout(_request: FastifyRequest, reply: FastifyReply) {
    // In v0.1, we don't need to do anything
    // In production, invalidate the token
    return reply.send({ message: 'Logged out successfully' });
  }

  private generateToken(userId: string, email: string): string {
    // In v0.1, we'll create a simple token
    // In production, use proper JWT with secret
    const payload = {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };
    
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    return `${header}.${body}.signature`;
  }

  private handleError(reply: FastifyReply, error: DomainError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  private handleValidationError(reply: FastifyReply, error: unknown) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error,
    });
  }
}
