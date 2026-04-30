import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DeepOnboardingController } from '../controllers/deep-onboarding-controller';
import { SupabaseDeepOnboardingRepository } from '../../data/repositories/SupabaseDeepOnboardingRepository';
import { GetDeepOnboardingForm } from '../../domain/use-cases/deep-onboarding/GetDeepOnboardingForm';
import { SubmitDeepOnboardingAnswers } from '../../domain/use-cases/deep-onboarding/SubmitDeepOnboardingAnswers';
import { LinkDeepOnboardingSession } from '../../domain/use-cases/deep-onboarding/LinkDeepOnboardingSession';
import { GetLatestDeepOnboardingSessionForUser } from '../../domain/use-cases/deep-onboarding/GetLatestDeepOnboardingSessionForUser';

declare module 'fastify' {
  interface FastifyInstance {
    authMiddleware: any;
  }
}

export const deepOnboardingRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const repository = new SupabaseDeepOnboardingRepository();
  const getForm = new GetDeepOnboardingForm(repository);
  const submit = new SubmitDeepOnboardingAnswers(repository);
  const linkSession = new LinkDeepOnboardingSession(repository);
  const getLatestForUser = new GetLatestDeepOnboardingSessionForUser(repository);
  const controller = new DeepOnboardingController(
    getForm,
    submit,
    linkSession,
    getLatestForUser
  );

  fastify.get(
    '/deep-onboarding/me',
    {
      preHandler: fastify.authMiddleware,
      schema: {
        description:
          'Questionnaire answers and client_session_id for the latest session linked to the user',
        tags: ['deep-onboarding'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
            clientSessionId: { type: ['string', 'null'] },
              answers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    questionCode: { type: 'string' },
                    singleKey: { type: ['string', 'null'] },
                    multiKeys: {
                      type: ['array', 'null'],
                      items: { type: 'string' },
                    },
                    textAnswer: { type: ['string', 'null'] },
                    otherDetails: {
                      type: ['object', 'null'],
                      additionalProperties: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          401: { type: 'object' },
          500: { type: 'object' },
        },
      },
    },
    controller.getMySession.bind(controller)
  );

  fastify.get(
    '/deep-onboarding/form',
    {
      schema: {
        description: 'Questionnaire definition for deep onboarding (affinity blocks)',
        tags: ['deep-onboarding'],
        response: {
          200: {
            type: 'object',
            properties: {
              blocks: { type: 'array' },
            },
          },
        },
      },
    },
    controller.getForm.bind(controller)
  );

  fastify.post(
    '/deep-onboarding/submit',
    {
      schema: {
        description: 'Persist answers for one or more questionnaire items',
        tags: ['deep-onboarding'],
        body: {
          type: 'object',
          required: ['clientSessionId', 'answers'],
          properties: {
            clientSessionId: { type: 'string', format: 'uuid' },
            userId: { type: ['string', 'null'], format: 'uuid' },
            answers: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['questionCode', 'questionTextSnapshot'],
                properties: {
                  questionCode: { type: 'string' },
                  questionTextSnapshot: { type: 'string' },
                  singleKey: { type: 'string' },
                  multiKeys: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  textAnswer: { type: ['string', 'null'] },
                  otherDetails: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              savedCount: { type: 'number' },
            },
          },
          400: { type: 'object' },
          500: { type: 'object' },
        },
      },
    },
    controller.submit.bind(controller)
  );

  fastify.post(
    '/deep-onboarding/link-session',
    {
      preHandler: fastify.authMiddleware,
      schema: {
        description:
          'Attach the anonymous deep onboarding session to the authenticated user',
        tags: ['deep-onboarding'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['clientSessionId'],
          properties: {
            clientSessionId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              linked: { type: 'boolean' },
            },
          },
          400: { type: 'object' },
          401: { type: 'object' },
          500: { type: 'object' },
        },
      },
    },
    controller.linkSession.bind(controller)
  );
};
