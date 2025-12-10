import { FastifyReply, FastifyRequest } from 'fastify';

type AdminAuthOptions = {
  headerSecret?: string;
  basicUser?: string;
  basicPassword?: string;
};

function decodeBasicAuth(header?: string) {
  if (!header || !header.startsWith('Basic ')) {
    return null;
  }

  try {
    const base64Credentials = header.replace('Basic ', '');
    const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    if (!username || typeof password === 'undefined') {
      return null;
    }
    return { username, password };
  } catch {
    return null;
  }
}

export function createAdminAuthMiddleware(options?: AdminAuthOptions) {
  const headerSecret =
    options?.headerSecret ||
    process.env.ADMIN_VERIFICATION_SECRET ||
    process.env.ADMIN_PANEL_SECRET;
  const basicUser = options?.basicUser || process.env.ADMIN_BASIC_USER;
  const basicPassword =
    options?.basicPassword || process.env.ADMIN_BASIC_PASSWORD;

  return async function adminAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Header-based secret (for automation or curl)
    if (headerSecret && request.headers['x-admin-secret'] === headerSecret) {
      return;
    }

    // Basic auth (best UX for browsers)
    const credentials = decodeBasicAuth(request.headers.authorization);
    if (basicUser && basicPassword && credentials) {
      const isValid =
        credentials.username === basicUser &&
        credentials.password === basicPassword;
      if (isValid) {
        return;
      }
    }

    const authConfigured = Boolean(
      headerSecret || (basicUser && basicPassword)
    );

    return reply
      .status(401)
      .header('WWW-Authenticate', 'Basic realm="Admin Panel"')
      .send({
        error: 'UNAUTHORIZED',
        message: authConfigured
          ? 'Admin credentials required'
          : 'Admin authentication is not configured. Set ADMIN_VERIFICATION_SECRET or ADMIN_BASIC_USER/ADMIN_BASIC_PASSWORD.',
      });
  };
}
