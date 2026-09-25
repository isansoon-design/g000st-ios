'use client';

import { Heart, MapPin, MessageCircle, Package, Pencil, Phone, Send, ShoppingBag, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { createMarketComment, createMarketPost, deleteMarketComment, deleteMarketPost, listMarketComments, listMarketPosts, toggleMarketLike, updateMarketPost, uploadMarketMedia, type MarketComment, type MarketPost, type MarketPostFields } from '@/app/api/market';
import { sessionStorage } from '@/app/api/session-storage';
import { useConfirmModal } from '@/context/ConfirmModalContext';
import { startChatConversation } from '@/features/chat/api';
import { useCalling } from '@/features/calling/use-calling';

const EMPTY_FIELDS: MarketPostFields = { content: '', price: 0, currency: 'GBP', quantity: 1, city: '', allowCalls: true, allowVideoCalls: false };

export default function MarketPage() {
  const router = useRouter();
  const { callUser } = useCalling();
  const { confirm } = useConfirmModal();
  const [view, setView] = useState<'home' | 'mine'>('home');
  const [posts, setPosts] = useState<MarketPost[]>([]);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [commentsPost, setCommentsPost] = useState<MarketPost>();
  const [editingPost, setEditingPost] = useState<MarketPost>();
  const feedRef = useRef<HTMLElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const myId = sessionStorage.get()?.user.publicId;

  const load = useCallback(async () => {
    try { const page = await listMarketPosts(undefined, view === 'mine' ? myId : undefined); setPosts(page.items); setNextCursor(page.nextCursor); }
    catch (error) { showError(error, 'Could not load Market.'); }
  }, [myId, view]);
  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try { const page = await listMarketPosts(nextCursor, view === 'mine' ? myId : undefined); setPosts((current) => [...current, ...page.items.filter((item) => !current.some((known) => known.id === item.id))]); setNextCursor(page.nextCursor); }
    catch (error) { showError(error, 'Could not load more listings.'); }
    finally { setLoadingMore(false); }
  }, [loadingMore, myId, nextCursor, view]);
  useEffect(() => { const target = loadMoreRef.current; if (!target || !nextCursor) return; const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) void loadMore(); }, { root: feedRef.current, rootMargin: '800px' }); observer.observe(target); return () => observer.disconnect(); }, [loadMore, nextCursor]);

  async function publish() {
    if (!validFields(fields) || busy) return toast.error('Add description, price, quantity, and city.');
    setBusy(true);
    try { const clientPostId = crypto.randomUUID(); const media = mediaFiles.length ? await Promise.all(mediaFiles.map((file) => uploadMarketMedia(clientPostId, file))) : undefined; const post = await createMarketPost(clientPostId, fields, media); setPosts((current) => [post, ...current]); setFields(EMPTY_FIELDS); setMediaFiles([]); toast.success('Listing published'); }
    catch (error) { showError(error, 'Could not publish listing.'); }
    finally { setBusy(false); }
  }

  async function openChat(post: MarketPost) { try { const conversation = await startChatConversation(post.ownerPublicId); router.push(`/chat?conversationId=${conversation.id}`); } catch (error) { showError(error, 'Could not open chat.'); } }

  return <div className="flex h-full flex-col bg-[#e7e7e9] text-[#171717]">
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 bg-gradient-to-b from-white to-[#c9c9cb] px-4 shadow-sm"><ShoppingBag size={21} /><h1 className="text-lg font-black">g<span className="text-[#c62828]">000</span>st Market</h1></header>
    <main ref={feedRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-3 p-3">
        <Composer fields={fields} mediaFiles={mediaFiles} busy={busy} onChange={setFields} onFiles={setMediaFiles} onPublish={() => void publish()} />
        {posts.length === 0 && <div className="py-16 text-center font-bold text-black/40">No listings yet.</div>}
        {posts.map((post) => <article key={post.id} className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[5px_6px_0_#111]">
          <div className="flex items-center gap-3 p-4"><div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-black text-white">{post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : '👻'}</div><div className="min-w-0 flex-1"><div className="truncate font-black">{post.author.displayName}</div><div className="text-xs text-black/45">{new Date(post.createdAtMs).toLocaleString()}{post.editedAtMs ? ' · edited' : ''}</div></div>{post.ownedByViewer && <><button aria-label="Edit" onClick={() => setEditingPost(post)} className="rounded-full border border-black p-2"><Pencil size={16} /></button><button aria-label="Delete" onClick={async () => { if (await confirm({ title: 'Delete listing?', message: 'This cannot be undone.', confirmLabel: 'Delete', isDangerous: true })) { await deleteMarketPost(post.id); setPosts((current) => current.filter((item) => item.id !== post.id)); } }} className="rounded-full border border-black p-2"><Trash2 size={16} /></button></>}</div>
          <p className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-6">{post.content}</p>
          <div className="mx-4 mb-3 flex flex-wrap gap-2"><Badge><b>{post.currency === 'GBP' ? `£${post.price.toLocaleString()}` : `${post.price.toLocaleString()} ${post.currency}`}</b></Badge><Badge><Package size={13} /> {post.quantity}</Badge><Badge><MapPin size={13} /> {post.city}</Badge></div>
          {post.media?.length ? <div className={`grid gap-1 ${post.media.length === 2 ? 'grid-cols-2' : ''}`}>{post.media.map((item) => item.kind === 'video' ? <video key={item.id} src={item.url} controls playsInline className="max-h-[32rem] w-full bg-black object-contain" /> : <img key={item.id} src={item.url} alt="" className="h-full max-h-[32rem] w-full object-cover" />)}</div> : null}
          <div className="flex items-center border-t border-black/10 p-2"><button onClick={async () => { const result = await toggleMarketLike(post.id); setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likedByViewer: result.liked, likeCount: result.likeCount } : item)); }} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-black ${post.likedByViewer ? 'text-[#c62828]' : ''}`}><Heart size={18} fill={post.likedByViewer ? 'currentColor' : 'none'} />{post.likeCount}</button><button onClick={() => setCommentsPost(post)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-black"><MessageCircle size={18} />{post.commentCount}</button>{!post.ownedByViewer && (post.allowCalls ?? true) && <button aria-label="Call seller" onClick={() => void callUser(post.ownerPublicId, 'audio')} className="flex flex-1 justify-center py-3"><Phone size={19} /></button>}{!post.ownedByViewer && post.allowVideoCalls && <button aria-label="Video call seller" onClick={() => void callUser(post.ownerPublicId, 'video')} className="flex flex-1 justify-center py-3">Video</button>}<button onClick={() => void openChat(post)} className="rounded-full bg-black px-6 py-3 font-black text-white">Chat</button></div>
        </article>)}
        <div ref={loadMoreRef} className="h-1" />{loadingMore && <div className="py-3 text-center text-xs font-bold">Loading…</div>}
      </div>
    </main>
    <nav className="flex h-14 shrink-0 border-t border-black/15 bg-white/90"><ViewButton active={view === 'home'} label="Market" onClick={() => setView('home')} /><ViewButton active={view === 'mine'} label="My Listings" onClick={() => setView('mine')} /></nav>
    <CommentsModal post={commentsPost} onClose={() => setCommentsPost(undefined)} onCountChange={(postId, delta) => setPosts((current) => current.map((item) => item.id === postId ? { ...item, commentCount: Math.max(0, item.commentCount + delta) } : item))} />
    <EditModal post={editingPost} onClose={() => setEditingPost(undefined)} onSave={async (postId, next) => { const updated = await updateMarketPost(postId, next); setPosts((current) => current.map((item) => item.id === postId ? updated : item)); setEditingPost(undefined); }} />
  </div>;
}

function Composer({ fields, mediaFiles, busy, onChange, onFiles, onPublish }: { fields: MarketPostFields; mediaFiles: File[]; busy: boolean; onChange: (fields: MarketPostFields) => void; onFiles: (files: File[]) => void; onPublish: () => void }) { return <section className="space-y-2 rounded-2xl border border-black/10 bg-white p-4"><textarea value={fields.content} onChange={(event) => onChange({ ...fields, content: event.target.value })} placeholder="What are you selling?" maxLength={4000} className="min-h-24 w-full resize-none rounded-xl border border-black/15 p-3 outline-none" /><div className="grid grid-cols-3 gap-2"><NumberInput value={fields.price || ''} placeholder="Price £" onChange={(price) => onChange({ ...fields, price })} /><NumberInput value={fields.quantity} placeholder="Quantity" onChange={(quantity) => onChange({ ...fields, quantity: Math.floor(quantity) })} /><input value={fields.city} onChange={(event) => onChange({ ...fields, city: event.target.value })} placeholder="City" maxLength={100} className="min-w-0 rounded-xl border border-black/15 px-3" /></div>{mediaFiles.length > 0 && <div className="flex gap-2 overflow-x-auto">{mediaFiles.map((file, index) => <FilePreview key={`${file.name}-${index}`} file={file} onRemove={() => onFiles(mediaFiles.filter((_, itemIndex) => itemIndex !== index))} />)}</div>}<CallOptions fields={fields} onChange={onChange} /><div className="flex justify-between"><label className="cursor-pointer rounded-xl border border-black/15 px-4 py-3 text-xs font-black">📎 {mediaFiles.length ? `${mediaFiles.length} selected` : 'Media'}<input className="hidden" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={(event) => { const files = [...(event.target.files ?? [])]; const videos = files.filter((file) => file.type.startsWith('video/')); if (files.some((file) => file.size > 5 * 1024 * 1024) || (videos.length && files.length !== 1) || (!videos.length && files.length > 2)) return toast.error('Choose up to two images or one video, max 5 MB each.'); onFiles(files); }} /></label><button disabled={busy} onClick={onPublish} className="rounded-xl bg-black px-6 py-3 font-black text-white disabled:opacity-40">{busy ? 'Posting…' : 'Post'}</button></div></section>; }

function CommentsModal({ post, onClose, onCountChange }: { post?: MarketPost; onClose: () => void; onCountChange: (postId: string, delta: number) => void }) { const [comments, setComments] = useState<MarketComment[]>([]); const [cursor, setCursor] = useState<string>(); const [value, setValue] = useState(''); const [loading, setLoading] = useState(false); useEffect(() => { if (!post) return; setLoading(true); setComments([]); void listMarketComments(post.id).then((page) => { setComments(page.items); setCursor(page.nextCursor); }).catch((error) => showError(error, 'Could not load comments.')).finally(() => setLoading(false)); }, [post]); if (!post) return null; async function send() { const content = value.trim(); if (!content) return; try { const item = await createMarketComment(post!.id, content); setComments((current) => [...current, item]); setValue(''); onCountChange(post!.id, 1); } catch (error) { showError(error, 'Could not add comment.'); } } return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5" role="dialog" aria-modal="true"><div className="flex h-[75dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-white p-4 shadow-2xl sm:rounded-[28px]"><div className="flex items-center justify-between border-b pb-3"><h2 className="text-lg font-black">Comments</h2><button aria-label="Close" onClick={onClose}><X /></button></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">{comments.map((item) => <div key={item.id} className="flex gap-2 rounded-xl bg-black/[.04] p-3"><p className="min-w-0 flex-1 text-sm"><b>{item.author.displayName}</b> {item.content}</p>{item.ownedByViewer && <button onClick={async () => { await deleteMarketComment(post!.id, item.id); setComments((current) => current.filter((comment) => comment.id !== item.id)); onCountChange(post!.id, -1); }} className="text-xs font-black text-[#c62828]">Delete</button>}</div>)}{!loading && !comments.length && <div className="py-16 text-center text-black/40">No comments yet.</div>}{cursor && <button disabled={loading} onClick={async () => { setLoading(true); try { const page = await listMarketComments(post!.id, cursor); setComments((current) => [...current, ...page.items]); setCursor(page.nextCursor); } finally { setLoading(false); } }} className="w-full py-3 text-sm font-black">{loading ? 'Loading…' : 'Load more'}</button>}</div><form className="flex gap-2 border-t pt-3" onSubmit={(event) => { event.preventDefault(); void send(); }}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Write a comment…" maxLength={1000} className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2" /><button aria-label="Send" className="rounded-xl bg-black px-4 text-white"><Send size={18} /></button></form></div></div>; }

function EditModal({ post, onClose, onSave }: { post?: MarketPost; onClose: () => void; onSave: (postId: string, fields: MarketPostFields) => Promise<void> }) { const [fields, setFields] = useState(EMPTY_FIELDS); useEffect(() => { if (post) setFields({ content: post.content, price: post.price, currency: post.currency, quantity: post.quantity, city: post.city, allowCalls: post.allowCalls ?? true, allowVideoCalls: post.allowVideoCalls ?? false }); }, [post]); if (!post) return null; return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-5"><div className="w-full max-w-lg space-y-3 rounded-[24px] bg-white p-5"><div className="flex justify-between"><h2 className="text-lg font-black">Edit listing</h2><button onClick={onClose}><X /></button></div><textarea value={fields.content} onChange={(event) => setFields({ ...fields, content: event.target.value })} className="min-h-28 w-full rounded-xl border border-black/15 p-3" /><div className="grid grid-cols-3 gap-2"><NumberInput value={fields.price} placeholder={fields.currency === 'GBP' ? 'Price £' : `Price ${fields.currency}`} onChange={(price) => setFields({ ...fields, price, currency: 'GBP' })} /><NumberInput value={fields.quantity} placeholder="Quantity" onChange={(quantity) => setFields({ ...fields, quantity: Math.floor(quantity) })} /><input value={fields.city} onChange={(event) => setFields({ ...fields, city: event.target.value })} className="min-w-0 rounded-xl border border-black/15 px-3" /></div>{post.currency !== 'GBP' && <p className="text-xs text-black/60">This listing is {post.currency}. Enter a new price to switch to £.</p>}<CallOptions fields={fields} onChange={setFields} /><button onClick={() => { if (validFields(fields)) void onSave(post.id, fields); }} className="w-full rounded-xl bg-black p-3 font-black text-white">Save</button></div></div>; }
function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) { const [url, setUrl] = useState(''); useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]); return <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/5">{file.type.startsWith('video/') ? <video src={url} className="h-full w-full object-cover" /> : <img src={url} alt="" className="h-full w-full object-cover" />}<button onClick={onRemove} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs text-white">×</button></div>; }
function NumberInput({ value, placeholder, onChange }: { value: number | string; placeholder: string; onChange: (value: number) => void }) { return <input type="number" min="0" step="any" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} placeholder={placeholder} className="min-w-0 rounded-xl border border-black/15 px-3 py-2" />; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs text-white">{children}</span>; }
function ViewButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button onClick={onClick} className={`flex-1 text-xs font-black ${active ? 'border-t-2 border-[#c62828]' : 'text-black/45'}`}>{label}</button>; }
function validFields(fields: MarketPostFields) { return Boolean(fields.content.trim() && fields.city.trim() && fields.price >= 0 && fields.quantity > 0); }
function showError(error: unknown, fallback: string) { toast.error(error instanceof Error ? error.message : fallback); }

function CallOptions({ fields, onChange }: { fields: MarketPostFields; onChange: (fields: MarketPostFields) => void }) { return <div className="flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={fields.allowCalls} onChange={(event) => onChange({ ...fields, allowCalls: event.target.checked })} /> Allow voice calls</label><label className="flex items-center gap-2"><input type="checkbox" checked={fields.allowVideoCalls} onChange={(event) => onChange({ ...fields, allowVideoCalls: event.target.checked })} /> Allow video calls</label></div>; }
