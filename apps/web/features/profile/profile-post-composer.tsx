'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { createSocialPost, uploadSocialMedia, type SocialPost, type SocialVisibility } from '@/app/api/social';

type Props = Readonly<{
  publicId: string;
  isPage: boolean;
  pageNamed: boolean;
  onPublished: (post: SocialPost) => void;
}>;

const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']);

export function ProfilePostComposer({ publicId, isPage, pageNamed, onPublished }: Props) {
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<SocialVisibility>('public');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

  function selectMedia(files: File[]) {
    const videos = files.filter((file) => file.type.startsWith('video/'));
    if (files.some((file) => !ALLOWED_MEDIA.has(file.type) || file.size > 5 * 1024 * 1024)) {
      toast.error('Choose supported media up to 5 MB per file.');
      return;
    }
    if (files.length > 2 || (videos.length > 0 && files.length !== 1)) {
      toast.error('Choose up to two images or one video.');
      return;
    }
    setMediaFiles(files);
  }

  async function publish() {
    const content = draft.trim();
    if (!content || posting || (isPage && !pageNamed)) return;
    setPosting(true);
    try {
      const clientPostId = crypto.randomUUID();
      const media = mediaFiles.length
        ? await Promise.all(mediaFiles.map((file) => uploadSocialMedia(clientPostId, file, publicId)))
        : undefined;
      const post = await createSocialPost(clientPostId, content, isPage ? 'public' : visibility, media, undefined, publicId);
      if (post.visibility === 'public') onPublished(post);
      setDraft('');
      setMediaFiles([]);
      toast.success(post.visibility === 'public' ? 'Posted to this profile.' : 'Posted anonymously to Social. It will not appear on this public profile.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post.');
    } finally {
      setPosting(false);
    }
  }

  return <section aria-label="Create social post" className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm dark:border-night-border dark:bg-night-surface">
    <h2 className="mb-3 text-sm font-black">New Social post</h2>
    <textarea
      aria-label="Post text"
      className="min-h-24 w-full resize-none rounded-2xl border border-black/15 bg-white p-3 text-sm outline-none dark:border-night-border dark:bg-night-raised"
      maxLength={4000}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={isPage ? 'Share something from this page…' : 'Share something…'}
      value={draft}
    />
    {mediaFiles.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{mediaFiles.map((file, index) => <MediaPreview key={`${file.name}-${index}`} file={file} onRemove={() => setMediaFiles((items) => items.filter((_, i) => i !== index))} />)}</div>}
    {isPage && !pageNamed && <p className="mt-2 text-xs font-bold text-[#c62828]">Name this page before posting.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded-xl border border-black/10 px-3 py-2 text-xs font-bold dark:border-night-border">📎 {mediaFiles.length ? `${mediaFiles.length} selected` : 'Media'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={(event) => { selectMedia([...(event.target.files ?? [])]); event.target.value = ''; }} /></label>
      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={isPage || visibility === 'public'} disabled={isPage} onChange={(event) => setVisibility(event.target.checked ? 'public' : 'anonymous')} />{isPage ? 'Page name is always shown' : 'Show my identity'}</label>
      <button type="button" disabled={!draft.trim() || posting || (isPage && !pageNamed)} onClick={() => void publish()} className="rounded-xl bg-[#222] px-5 py-2 text-sm font-black text-white disabled:opacity-40">{posting ? 'Posting…' : 'Post'}</button>
    </div>
  </section>;
}

function MediaPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5 dark:bg-white/10">
    {url && (file.type.startsWith('video/') ? <video src={url} className="h-full w-full object-cover" /> : <img src={url} alt="" className="h-full w-full object-cover" />)}
    <button type="button" aria-label={`Remove ${file.name}`} onClick={onRemove} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs font-bold text-white">×</button>
  </div>;
}
