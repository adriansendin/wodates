import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function registerCors(fastify: FastifyInstance) {
  const defaultOrigins = [
    'http://localhost:8081',
    'http://localhost:19006',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:19006',
  ];
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  const allowedOrigins = [...defaultOrigins, ...envOrigins];

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        // Allow server-to-server or curl requests with no origin
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });
}
