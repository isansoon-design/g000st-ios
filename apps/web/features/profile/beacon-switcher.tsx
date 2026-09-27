'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';

import { createBeaconPage, listBeaconPages, type BeaconPage } from '@/app/api/auth';
import { sessionStorage } from '@/app/api/session-storage';

export function BeaconSwitcher({ selectedDisplayName }: { selectedDisplayName?: string }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const ownerId = sessionStorage.get()?.user.publicId;
  const activeId = sessionStorage.getActingPublicId();
  const personalSelected = !!ownerId && activeId === ownerId;
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const [creating, setCreating] = useState(false);

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

  const switchTo = (publicId: string, displayName: string) => {
    if (activeId !== publicId) sessionStorage.setActingPublicId(publicId);
    toast.success(`أنت الآن تتفاعل باسم ${displayName}`);
    router.push('/social');
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await createBeaconPage();
      sessionStorage.setActingPublicId(page.publicId);
      window.location.assign('/profile');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create page.');
      setCreating(false);
    }
  };

  if (!mounted) return null;
  return <section className="mb-4 w-full rounded-[18px] border border-white/60 dark:border-white/20 bg-[#D0D0D0] dark:bg-night-header p-4">
    <div className="mb-2 text-[10px] font-black uppercase tracking-[1px] text-black/45 dark:text-night-muted">Interact as</div>
    {ownerId && <button type="button" onClick={() => switchTo(ownerId, 'ملفك الشخصي')} aria-pressed={personalSelected} className={`mb-2 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors ${personalSelected ? 'bg-[#17191d] text-white' : 'bg-white dark:bg-night-surface text-[#17191d] dark:text-night-text hover:bg-white/80'}`}><span className="min-w-0"><span className="block font-black">My personal profile</span><span className="block text-xs opacity-60">{ownerId.slice(0, 8)}</span></span>{personalSelected && <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold"><Check aria-hidden="true" size={17} strokeWidth={3} /> Active now</span>}</button>}
    {pages.map((page) => {
      const selected = activeId === page.publicId;
      return <button key={page.publicId} type="button" onClick={() => switchTo(page.publicId, page.displayName || 'صفحة بلا اسم')} aria-pressed={selected} className={`mb-2 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors ${selected ? 'bg-[#17191d] text-white' : 'bg-white dark:bg-night-surface text-[#17191d] dark:text-night-text hover:bg-white/80'}`}><span className="min-w-0"><span className="block break-words font-black">{(selected ? selectedDisplayName : page.displayName) || 'Untitled beacon'}</span><span className="block text-xs opacity-60">{page.publicId.slice(0, 8)}</span></span>{selected && <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold"><Check aria-hidden="true" size={17} strokeWidth={3} /> Active now</span>}</button>;
    })}
    <button type="button" disabled={creating} onClick={() => void create()} className="mt-1 w-full rounded-xl bg-[#C62828] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{creating ? 'Creating…' : 'BUILD YOUR BEACON'}</button>
  </section>;
}
