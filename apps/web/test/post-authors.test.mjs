import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePostAuthors as webResolve } from '../lib/post-authors.ts';
import { resolvePostAuthors as mobileResolve } from '../../mobile/src/api/post-authors.ts';

for (const [platform, resolve] of [['web', webResolve], ['mobile', mobileResolve]]) {
  describe(`${platform} publisher resolution with older API responses`, () => {
    it('marks page posts red and user posts black using profile identity', async () => {
      const posts = [
        { id: 'page-post', author: { publicId: 'page', displayName: 'برمجة' } },
        { id: 'user-post', author: { publicId: 'user', displayName: 'User' } },
      ];
      const resolved = await resolve(posts, async (id) => ({ isPage: id === 'page' }));
      assert.equal(resolved[0].author.isPage, true);
      assert.equal(resolved[1].author.isPage, false);
      assert.equal(posts[0].author.isPage, undefined);
    });

    it('supports a newly created page post before refreshing the feed', async () => {
      const [post] = await resolve([{ author: { publicId: 'page' } }], async () => ({ isPage: true }));
      assert.equal(post.author.isPage, true);
    });

    it('uses explicit API values without requesting profiles', async () => {
      let calls = 0;
      const posts = [{ author: { publicId: 'page', isPage: true } }, { author: { publicId: 'user', isPage: false } }];
      assert.deepEqual(await resolve(posts, async () => { calls++; return { isPage: true }; }), posts);
      assert.equal(calls, 0);
    });

    it('deduplicates profile requests for repeated and shared authors', async () => {
      let calls = 0;
      const resolved = await resolve([
        { author: { publicId: 'page' }, sharedPost: { content: 'Original', author: { publicId: 'page' } } },
        { author: { publicId: 'page' } },
      ], async () => { calls++; return { isPage: true }; });
      assert.equal(calls, 1);
      assert.equal(resolved[0].sharedPost.author.isPage, true);
      assert.equal(resolved[0].sharedPost.content, 'Original');
    });

    it('does not look up an anonymous author through the private owner ID', async () => {
      let calls = 0;
      const posts = [{ ownerPublicId: 'private-owner', author: { displayName: 'Anonymous' } }];
      assert.deepEqual(await resolve(posts, async () => { calls++; return { isPage: true }; }), posts);
      assert.equal(calls, 0);
    });

    it('keeps posts available after a profile failure and retries on the next load', async () => {
      const posts = [{ author: { publicId: 'page' } }];
      assert.deepEqual(await resolve(posts, async () => { throw new Error('Network unavailable'); }), posts);
      const [retried] = await resolve(posts, async () => ({ isPage: true }));
      assert.equal(retried.author.isPage, true);
    });
  });
}
