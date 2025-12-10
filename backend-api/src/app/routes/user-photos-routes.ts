import { FastifyInstance } from 'fastify';
import { UserPhotosController } from '../controllers/user-photos-controller';
import { UserPhotoService } from '../services/user-photo-service';

export async function userPhotosRoutes(fastify: FastifyInstance) {
  const photoService = new UserPhotoService();
  const controller = new UserPhotosController(photoService);

  fastify.get(
    '/users/me/photos',
    {
      schema: {
        description: 'List user photos',
        tags: ['user-photos'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              photos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    user_id: { type: 'string', format: 'uuid' },
                    storage_path: { type: 'string' },
                    public_url: { type: 'string', format: 'uri' },
                    is_main: { type: 'boolean' },
                    position: { type: 'number' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.listUserPhotos.bind(controller)
  );

  fastify.post(
    '/users/me/photos',
    {
      schema: {
        description: 'Add user photo',
        tags: ['user-photos'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              photo: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  user_id: { type: 'string', format: 'uuid' },
                  storage_path: { type: 'string' },
                  public_url: { type: 'string', format: 'uri' },
                  is_main: { type: 'boolean' },
                  position: { type: 'number' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.addUserPhoto.bind(controller)
  );

  fastify.put(
    '/users/me/photos/:photoId/main',
    {
      schema: {
        description: 'Set photo as main',
        tags: ['user-photos'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            photoId: { type: 'string', format: 'uuid' },
          },
          required: ['photoId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              photo: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  user_id: { type: 'string', format: 'uuid' },
                  storage_path: { type: 'string' },
                  public_url: { type: 'string', format: 'uri' },
                  is_main: { type: 'boolean' },
                  position: { type: 'number' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.setMainPhoto.bind(controller)
  );

  fastify.delete(
    '/users/me/photos/:photoId',
    {
      schema: {
        description: 'Delete user photo',
        tags: ['user-photos'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            photoId: { type: 'string', format: 'uuid' },
          },
          required: ['photoId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authMiddleware,
    },
    controller.deleteUserPhoto.bind(controller)
  );
}


