import { Facebook, Instagram, Linkedin, Mail, Phone } from 'lucide-react';

import type { SocialProfile } from '@/app/api/social';

type Kind = 'whatsapp' | 'phone' | 'email' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin';

const STYLE: Record<Kind, string> = {
  whatsapp: 'bg-[#25D366] shadow-[#25D366]/25',
  phone: 'bg-[#334155] shadow-[#334155]/25',
  email: 'bg-[#EA4335] shadow-[#EA4335]/25',
  facebook: 'bg-[#1877F2] shadow-[#1877F2]/25',
  instagram: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] shadow-[#DD2A7B]/25',
  tiktok: 'bg-[#111318] shadow-black/25',
  linkedin: 'bg-[#0A66C2] shadow-[#0A66C2]/25',
};

function ContactIcon({ kind }: { kind: Kind }) {
  if (kind === 'whatsapp') return <svg aria-hidden="true" width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.2A8 8 0 1 1 20 11.5Z"/><path d="M8.5 8.4c.4-.5.9-.5 1.2.1l.7 1.2c.2.4.1.6-.2.9l-.4.5c.7 1.3 1.7 2.3 3 3l.5-.4c.3-.3.6-.4.9-.2l1.2.7c.6.3.6.8.1 1.2-.8.7-1.6.7-2.5.3-2.4-1-4.4-3-5.3-5.3-.4-.9-.4-1.7.3-2.5Z" strokeWidth="1.3"/></svg>;
  if (kind === 'tiktok') return <svg aria-hidden="true" width="29" height="29" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"><path d="M14 3v11.1a4 4 0 1 1-4-4" stroke="#25F4EE" transform="translate(-.7 .5)"/><path d="M14 3c.4 2.7 2 4.3 5 4.6" stroke="#FE2C55" transform="translate(.6 -.2)"/><path d="M14 3v11.1a4 4 0 1 1-4-4M14 3c.4 2.7 2 4.3 5 4.6" stroke="white"/></svg>;
  const Icon = { phone: Phone, email: Mail, facebook: Facebook, instagram: Instagram, linkedin: Linkedin }[kind];
  return <Icon aria-hidden="true" size={28} strokeWidth={2.2} />;
}

export function PageContactLinks({ profile }: { profile: SocialProfile }) {
  const links: { kind: Kind; href?: string; label: string; external?: boolean }[] = [
    { kind: 'whatsapp', href: profile.whatsappNumber ? `https://wa.me/${profile.whatsappNumber.replace(/\D/g, '')}` : undefined, label: 'Chat on WhatsApp', external: true },
    { kind: 'phone', href: profile.landlineNumber ? `tel:${profile.landlineNumber}` : undefined, label: `Call ${profile.landlineNumber ?? 'landline'}` },
    { kind: 'email', href: profile.contactEmail ? `mailto:${profile.contactEmail}` : undefined, label: `Email ${profile.contactEmail ?? 'page'}` },
    { kind: 'facebook', href: profile.facebookUrl, label: 'Open Facebook', external: true },
    { kind: 'instagram', href: profile.instagramUrl, label: 'Open Instagram', external: true },
    { kind: 'tiktok', href: profile.tiktokUrl, label: 'Open TikTok', external: true },
    { kind: 'linkedin', href: profile.linkedinUrl, label: 'Open LinkedIn', external: true },
  ];
  const available = links.filter((link): link is typeof link & { href: string } => !!link.href);
  if (!available.length) return null;

  return <nav aria-label="Page contact links" className="mt-5 flex flex-wrap justify-center gap-3 border-t border-black/10 pt-5 dark:border-night-border">
    {available.map((link) => <a key={link.kind} href={link.href} aria-label={link.label} title={link.label} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined} className={`grid h-14 w-14 place-items-center rounded-[18px] text-white shadow-lg transition duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C62828] ${STYLE[link.kind]}`}><ContactIcon kind={link.kind} /></a>)}
  </nav>;
}
