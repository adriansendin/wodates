import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.substring(7);
  
  try {
    // In v0.1, we'll use a simple token validation
    // In production, use proper JWT verification
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(Buffer.from(tokenParts[1] || '', 'base64').toString());
    
    if (!payload.userId || !payload.email) {
      throw new Error('Invalid token payload');
    }

    request.user = {
      id: payload.userId,
      email: payload.email,
    };
  } catch (error) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid token',
    });
  }
}
