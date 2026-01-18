import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function registerCors(fastify: FastifyInstance) {
  const defaultOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:19006',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:19006',
    'http://localhost:3000',
    'https://overargumentative-cayson-pertly.ngrok-free.dev',
    'http://127.0.0.1:3000',
  ];
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];

  const allowedOrigins = [...defaultOrigins, ...envOrigins];

  // Regex to match local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  // Allows common dev ports: 8080 (serve), 8081 (Expo web), 19006 (Expo), 3000 (dev server)
  const localNetworkRegex =
    /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}):(8080|8081|19006|3000)$/;

  await fastify.register(cors, {
    origin: (origin, callback) => {
      console.log(`[CORS] Checking origin: ${origin || 'none'}`);
      console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);

      if (!origin) {
        // Allow server-to-server or curl requests with no origin
        console.log('[CORS] Allowing request with no origin');
        return callback(null, true);
      }

      // Check exact match first
      if (allowedOrigins.includes(origin)) {
        console.log(`[CORS] Origin ${origin} is allowed`);
        return callback(null, true);
      }

      // Check if it's a local network IP (for physical devices)
      if (localNetworkRegex.test(origin)) {
        console.log(`[CORS] Local network IP ${origin} is allowed`);
        return callback(null, true);
      }

      console.error(`[CORS] Origin ${origin} NOT allowed`);
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });
}
