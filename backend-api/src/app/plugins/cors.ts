import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function registerCors(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8081',
    credentials: true,
  });
}
