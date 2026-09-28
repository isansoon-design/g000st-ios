import { Linking, Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Toast from 'react-native-toast-message';

import type { SocialProfile } from '@/domain/social/types';

type Kind = 'whatsapp' | 'phone' | 'email' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
type ContactLink = { kind: Kind; href?: string; label: string; color: string };

function ContactIcon({ kind }: { kind: Kind }) {
  return <Svg width={29} height={29} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
    {kind === 'whatsapp' && <><Path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.2A8 8 0 1 1 20 11.5Z" stroke="white" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"/><Path d="M8.5 8.4c.4-.5.9-.5 1.2.1l.7 1.2c.2.4.1.6-.2.9l-.4.5c.7 1.3 1.7 2.3 3 3l.5-.4c.3-.3.6-.4.9-.2l1.2.7c.6.3.6.8.1 1.2-.8.7-1.6.7-2.5.3-2.4-1-4.4-3-5.3-5.3-.4-.9-.4-1.7.3-2.5Z" stroke="white" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"/></>}
    {kind === 'phone' && <Path d="M6 3h3l1.5 4-2 1.7a14 14 0 0 0 6.8 6.8l1.7-2L21 15v3c0 1.7-1.3 3-3 3C9.7 21 3 14.3 3 6c0-1.7 1.3-3 3-3Z" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>}
    {kind === 'email' && <><Rect x={3} y={5} width={18} height={14} rx={2} stroke="white" strokeWidth={1.9}/><Path d="m3 7 9 6 9-6" stroke="white" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"/></>}
    {kind === 'facebook' && <Path d="M15.4 4H13c-2.2 0-3.5 1.3-3.5 3.6V10H7v3h2.5v7h3.2v-7h2.6l.4-3h-3V7.9c0-.6.2-.9.9-.9h1.8V4Z" fill="white"/>}
    {kind === 'instagram' && <><Rect x={3} y={3} width={18} height={18} rx={5} stroke="white" strokeWidth={2}/><Circle cx={12} cy={12} r={4} stroke="white" strokeWidth={2}/><Circle cx={17.3} cy={6.8} r={1.2} fill="white"/></>}
    {kind === 'tiktok' && <><Path d="M14 3v11.1a4 4 0 1 1-4-4" stroke="#25F4EE" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" transform="translate(-.7 .5)"/><Path d="M14 3c.4 2.7 2 4.3 5 4.6" stroke="#FE2C55" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" transform="translate(.6 -.2)"/><Path d="M14 3v11.1a4 4 0 1 1-4-4M14 3c.4 2.7 2 4.3 5 4.6" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></>}
    {kind === 'linkedin' && <><Circle cx={5.5} cy={5.8} r={1.6} fill="white"/><Rect x={4} y={9} width={3} height={11} fill="white"/><Path d="M10 9h3v1.6c.7-1.2 1.7-1.9 3.3-1.9 2.8 0 4.2 1.8 4.2 4.9V20h-3.1v-5.8c0-1.7-.6-2.6-2-2.6-1.3 0-2.3 1-2.3 2.7V20H10V9Z" fill="white"/></>}
  </Svg>;
}

export function PageContactLinks({ profile }: { profile: SocialProfile }) {
  const links: ContactLink[] = [
    { kind: 'whatsapp', href: profile.whatsappNumber ? `https://wa.me/${profile.whatsappNumber.replace(/\D/g, '')}` : undefined, label: 'Chat on WhatsApp', color: '#25D366' },
    { kind: 'phone', href: profile.landlineNumber ? `tel:${profile.landlineNumber}` : undefined, label: `Call ${profile.landlineNumber ?? 'landline'}`, color: '#334155' },
    { kind: 'email', href: profile.contactEmail ? `mailto:${profile.contactEmail}` : undefined, label: `Email ${profile.contactEmail ?? 'page'}`, color: '#EA4335' },
    { kind: 'facebook', href: profile.facebookUrl, label: 'Open Facebook', color: '#1877F2' },
    { kind: 'instagram', href: profile.instagramUrl, label: 'Open Instagram', color: '#D62976' },
    { kind: 'tiktok', href: profile.tiktokUrl, label: 'Open TikTok', color: '#111318' },
    { kind: 'linkedin', href: profile.linkedinUrl, label: 'Open LinkedIn', color: '#0A66C2' },
  ];
  const available = links.filter((link): link is ContactLink & { href: string } => !!link.href);
  if (!available.length) return null;

  return <View className="mt-5 flex-row flex-wrap justify-center gap-3 border-t border-black/10 pt-5 dark:border-night-border">
    {available.map((link) => <Pressable key={link.kind} accessibilityRole="link" accessibilityLabel={link.label} onPress={() => void Linking.openURL(link.href).catch(() => Toast.show({ type: 'error', text1: 'Could not open link', text2: link.label }))} className="h-14 w-14 items-center justify-center rounded-[18px]" style={({ pressed }) => ({ backgroundColor: link.color, elevation: 3, shadowColor: link.color, shadowOpacity: 0.25, shadowRadius: 9, transform: [{ scale: pressed ? 0.94 : 1 }] })}><ContactIcon kind={link.kind}/></Pressable>)}
  </View>;
}
