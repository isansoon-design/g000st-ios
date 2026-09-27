'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { createBeaconPage, listBeaconPages, type BeaconPage } from '@/app/api/auth';
import { sessionStorage } from '@/app/api/session-storage';
import { updateSocialProfile, uploadAvatarMedia, uploadCoverMedia } from '@/app/api/social';

function validateImage(file: File | null): boolean {
  if (!file) return true;
  if (file.size <= 3 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return true;
  toast.error('Choose a JPEG, PNG, WebP, or GIF image up to 3 MB.');
  return false;
}

export function BeaconSwitcher() {
  const [mounted, setMounted] = useState(false);
  const ownerId = sessionStorage.get()?.user.publicId;
  const activeId = sessionStorage.getActingPublicId();
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let mounted = true;
    void listBeaconPages().then((items) => {
      if (!mounted) return;
      setPages(items);
      if (activeId && activeId !== ownerId && !items.some((page) => page.publicId === activeId) && ownerId) {
        sessionStorage.setActingPublicId(ownerId);
        window.location.reload();
      }
    }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load pages.'));
    return () => { mounted = false; };
  }, [activeId, ownerId]);

  const switchTo = (publicId: string) => {
    if (activeId === publicId) return;
    sessionStorage.setActingPublicId(publicId);
    window.location.reload();
  };

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const page = await createBeaconPage(name.trim(), bio.trim());
      sessionStorage.setActingPublicId(page.publicId);
      try {
        const [avatarMedia, coverMedia] = await Promise.all([
          avatar ? uploadAvatarMedia(avatar) : undefined,
          cover ? uploadCoverMedia(cover) : undefined,
        ]);
        if (avatarMedia || coverMedia) await updateSocialProfile({ ...(avatarMedia ? { avatarMedia } : {}), ...(coverMedia ? { coverMedia } : {}) });
      } catch {
        toast.error('Page created. Add its images from the page profile.');
        window.setTimeout(() => window.location.reload(), 1200);
        return;
      }
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create page.');
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return <section className="mb-4 w-full rounded-[18px] border border-white/60 bg-[#D0D0D0] p-4">
    <div className="mb-2 text-[10px] font-black uppercase tracking-[1px] text-black/45">Interact as</div>
    {ownerId && <button type="button" onClick={() => switchTo(ownerId)} aria-pressed={activeId === ownerId} className={`mb-2 w-full rounded-xl px-4 py-3 text-left font-black ${activeId === ownerId ? 'bg-[#17191d] text-white' : 'bg-white text-[#17191d]'}`}>My personal profile</button>}
    {pages.map((page) => <button key={page.publicId} type="button" onClick={() => switchTo(page.publicId)} aria-pressed={activeId === page.publicId} className={`mb-2 w-full rounded-xl px-4 py-3 text-left ${activeId === page.publicId ? 'bg-[#17191d] text-white' : 'bg-white text-[#17191d]'}`}><span className="block font-black">{page.displayName}</span><span className="block text-xs opacity-60">{page.publicId.slice(0, 8)}</span></button>)}
    {!creating ? <button type="button" onClick={() => setCreating(true)} className="mt-1 w-full rounded-xl bg-[#C62828] px-4 py-3 text-sm font-black text-white">BUILD YOUR BEACON</button> : <div className="mt-2 space-y-2">
      <div className="text-sm font-black">BUILD YOUR BEACON</div>
      <input aria-label="Page name" placeholder="Page name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl bg-white px-3 py-3" />
      <textarea aria-label="Page description" placeholder="Short description" maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-20 w-full rounded-xl bg-white px-3 py-3" />
      <div className="flex gap-2">
        <label className="flex-1 cursor-pointer rounded-xl bg-white p-3 text-center text-xs font-black">{avatar ? '✓ Photo' : 'Add photo'}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (validateImage(file)) setAvatar(file); }} /></label>
        <label className="flex-1 cursor-pointer rounded-xl bg-white p-3 text-center text-xs font-black">{cover ? '✓ Cover' : 'Add cover'}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (validateImage(file)) setCover(file); }} /></label>
      </div>
      <button type="button" disabled={saving || !name.trim()} onClick={() => void create()} className="w-full rounded-xl bg-[#C62828] p-3 font-black text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create page'}</button>
      <button type="button" disabled={saving} onClick={() => setCreating(false)} className="w-full p-2 text-xs font-bold text-black/50">Cancel</button>
    </div>}
  </section>;
}
