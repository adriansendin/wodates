import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function registerRateLimit(fastify: FastifyInstance) {
  // Skip rate limiting if explicitly disabled
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return;
  }

  // In development, use much more permissive limits to avoid blocking during testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const max = isDevelopment
    ? parseInt(process.env.RATE_LIMIT_MAX || '1000') // 1000 requests in dev
    : parseInt(process.env.RATE_LIMIT_MAX || '100'); // 100 requests in production
  
  const timeWindow = isDevelopment
    ? parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000') // 1 minute in dev
    : parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000'); // 1 minute in production

  await fastify.register(rateLimit, {
    max,
    timeWindow,
  });
}
