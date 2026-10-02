type PostAuthor = { publicId?: string; isPage?: boolean };
type AuthoredPost = { author: PostAuthor; sharedPost?: { author: PostAuthor } };

/** Older API responses omit isPage; use the existing profile contract in that case. */
export async function resolvePostAuthors<T extends AuthoredPost>(
  posts: readonly T[],
  getProfile: (publicId: string) => Promise<{ isPage: boolean }>,
): Promise<T[]> {
  const lookups = new Map<string, Promise<boolean | undefined>>();
  async function resolveAuthor<A extends PostAuthor>(author: A): Promise<A> {
    // Only use the visible author ID, never the private post owner ID.
    if (typeof author.isPage === 'boolean' || !author.publicId) return author;
    const publicId = author.publicId;
    if (!lookups.has(publicId)) {
      lookups.set(publicId, getProfile(publicId).then((profile) => profile.isPage).catch(() => undefined));
    }
    const isPage = await lookups.get(publicId);
    // Profile failures must not prevent the feed from loading or be cached as users.
    return typeof isPage === 'boolean' ? { ...author, isPage } : author;
  }
  return Promise.all(posts.map(async (post) => ({
    ...post,
    author: await resolveAuthor(post.author),
    ...(post.sharedPost ? {
      sharedPost: { ...post.sharedPost, author: await resolveAuthor(post.sharedPost.author) },
    } : {}),
  })));
}
