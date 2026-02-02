import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocLoveHelper } from '../../../app/services/doc-love-helper';

const DOC_LOVE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('DocLoveHelper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    DocLoveHelper.clearCache();
  });

  describe('getDocLoveUserId', () => {
    it('returns DOC_LOVE_ID from env when set and valid UUID', async () => {
      process.env.DOC_LOVE_ID = DOC_LOVE_ID;
      const helper = new DocLoveHelper();
      const userId = await helper.getDocLoveUserId();
      expect(userId).toBe(DOC_LOVE_ID);
    });

    it('returns trimmed DOC_LOVE_ID when env has surrounding spaces', async () => {
      process.env.DOC_LOVE_ID = `  ${DOC_LOVE_ID}  `;
      const helper = new DocLoveHelper();
      const userId = await helper.getDocLoveUserId();
      expect(userId).toBe(DOC_LOVE_ID);
    });

    it('throws when DOC_LOVE_ID is not set', async () => {
      delete process.env.DOC_LOVE_ID;
      const helper = new DocLoveHelper();
      await expect(helper.getDocLoveUserId()).rejects.toThrow(
        /DOC_LOVE_ID is required/
      );
    });

    it('throws when DOC_LOVE_ID is empty string', async () => {
      process.env.DOC_LOVE_ID = '';
      const helper = new DocLoveHelper();
      await expect(helper.getDocLoveUserId()).rejects.toThrow(
        /DOC_LOVE_ID is required/
      );
    });

    it('throws when DOC_LOVE_ID is not a valid UUID', async () => {
      process.env.DOC_LOVE_ID = 'not-a-uuid';
      const helper = new DocLoveHelper();
      await expect(helper.getDocLoveUserId()).rejects.toThrow(
        /DOC_LOVE_ID must be a valid UUID/
      );
    });

    it('throws when DOC_LOVE_ID is malformed UUID', async () => {
      process.env.DOC_LOVE_ID = '87ca0479-a2b7-47eb-97b3'; // too short
      const helper = new DocLoveHelper();
      await expect(helper.getDocLoveUserId()).rejects.toThrow(
        /DOC_LOVE_ID must be a valid UUID/
      );
    });
  });
});
