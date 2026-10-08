import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import Toast from "react-native-toast-message";

import { listBeaconPages, subscribeToBeaconPageCreated, type BeaconPage } from "@/api/auth";
import { getSocialProfile } from "@/api/social";
import { IdentityKindIcon } from "@/components/brand/identity-kind-icon";
import type { SocialProfile } from "@/domain/social/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { BeaconPageEditor } from "@/features/identity/components/beacon-page-editor";
import { avatarImageSource } from "@/services/media/avatar-image-source";
import { useAppTheme } from "@/theme/app-theme";

const SidebarContext = createContext<(() => void) | null>(null);
const PageEditorContext = createContext<
  | ((publicId?: string, onSaved?: (profile: SocialProfile) => void) => void)
  | null
>(null);
const links = [
  ["Social", "/(app)/(tabs)/social", "social"],
  ["Chat", "/(app)/(tabs)/chat", "chat"],
  ["Friends", "/(app)/(tabs)/contacts", "friends"],
  ["Profile", "/(app)/(tabs)/identity", "profile"],
  ["Trading", "/(app)/(tabs)/trading", "trading"],
  ["Mobile", "/(app)/(tabs)/mobile", "mobile"],
] as const;

type SidebarIconName = (typeof links)[number][2];

function SidebarLinkIcon({
  name,
  color,
}: {
  name: SidebarIconName;
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      {name === "social" && (
        <>
          <Circle cx={14} cy={14} r={10} {...common} />
          <Path
            d="M4 14h20M14 4c-3 3-4.5 6.3-4.5 10S11 21 14 24M14 4c3 3 4.5 6.3 4.5 10S17 21 14 24"
            {...common}
          />
        </>
      )}
      {name === "chat" && (
        <Path
          d="M5 5.5h18a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H11l-7 4v-5a2 2 0 0 1-1-1.7V7.5a2 2 0 0 1 2-2Z"
          {...common}
        />
      )}
      {name === "friends" && (
        <>
          <Circle cx={11} cy={9} r={3.5} {...common} />
          <Path
            d="M3.5 22v-2a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v2H3.5ZM19 6a3.5 3.5 0 0 1 0 7M21 15a4 4 0 0 1 3.5 4v3h-3"
            {...common}
          />
        </>
      )}
      {name === "profile" && (
        <>
          <Rect x={3} y={5} width={22} height={18} rx={3} {...common} />
          <Circle cx={10} cy={12} r={2.5} {...common} />
          <Path
            d="M6.5 19c.5-2.2 1.7-3.2 3.5-3.2s3 1 3.5 3.2M17 11h5M17 15h5"
            {...common}
          />
        </>
      )}
      {name === "trading" && (
        <>
          <Path d="M4 10h20l-1.5 14h-17L4 10Z" {...common} />
          <Path d="M9 10V8a5 5 0 0 1 10 0v2" {...common} />
        </>
      )}
      {name === "mobile" && (
        <>
          <Rect x={7} y={2} width={14} height={24} rx={3} {...common} />
          <Path d="M12 5h4M13 22h2" {...common} />
        </>
      )}
    </Svg>
  );
}

function ActiveIdentityCheck() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M5 12l4 4L19 6" stroke="#C62828" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IdentityAvatar({ avatarUrl, name }: Readonly<{ avatarUrl?: string; name: string }>) {
  return avatarUrl ? (
    <Image
      source={avatarImageSource(avatarUrl)}
      contentFit="cover"
      style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0 }}
    />
  ) : (
    <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-g000st-silver">
      <Text className="font-black text-white">{name[0]}</Text>
    </View>
  );
}

export function useOpenAppSidebar() {
  return use(SidebarContext);
}
export function useOpenBeaconPageEditor() {
  return use(PageEditorContext);
}

export function AppSidebarProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { user, activePublicId, setActivePublicId } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<BeaconPage[]>([]);
  const pagesRevision = useRef(0);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [pageProfiles, setPageProfiles] = useState<Record<string, SocialProfile>>({});
  const pageIds = pages.map((page) => page.publicId).join(",");
  const [editor, setEditor] = useState<{
    publicId?: string;
    onSaved?: (profile: SocialProfile) => void;
  } | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!user) return;
    return subscribeToBeaconPageCreated((page) => {
      pagesRevision.current += 1;
      setPages((items) => [page, ...items.filter((item) => item.publicId !== page.publicId)]);
    });
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    void getSocialProfile(user.publicId)
      .then((person) => {
        if (active) setProfile(person);
      })
      .catch(() => undefined);
    const revision = pagesRevision.current;
    void listBeaconPages()
      .then((items) => {
        // A list requested before creation must not remove the new page.
        if (active && revision === pagesRevision.current) setPages(items);
      })
      .catch(() => {
        if (active)
          Toast.show({ type: "error", text1: "Could not load your pages" });
      });
    return () => {
      active = false;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open || !user || !pageIds) return;
    let active = true;
    for (const id of pageIds.split(",")) {
      void getSocialProfile(id)
        .then((pageProfile) => {
          if (active) setPageProfiles((items) => ({ ...items, [id]: pageProfile }));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [open, pageIds, user]);

  const visit = (href: Href) => {
    close();
    router.push(href);
  };
  const switchTo = (id: string) => {
    close();
    if (activePublicId !== id) setActivePublicId(id);
    router.replace("/(app)/(tabs)/social");
  };
  const openEditor = useCallback(
    (publicId?: string, onSaved?: (value: SocialProfile) => void) => {
      close();
      setEditor({ publicId, onSaved });
    },
    [close],
  );

  return (
    <SidebarContext value={() => setOpen(true)}>
      <PageEditorContext value={openEditor}>
        {children}
        {editor && (
          <BeaconPageEditor
            visible={editor !== null}
            publicId={editor?.publicId}
            onClose={() => setEditor(null)}
            onSaved={(value) => editor?.onSaved?.(value)}
            onCreated={(id) => {
              router.replace({
                pathname: "/beacons/[publicId]/first-post",
                params: { publicId: id },
              });
            }}
          />
        )}
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={close}
          statusBarTranslucent
        >
          <View className="flex-1 flex-row bg-black/50">
            <View
              className="w-[82%] max-w-[340px]"
              style={{
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                backgroundColor: colors.canvas,
              }}
            >
              <ScrollView
                contentContainerClassName="p-4 pb-8"
                keyboardShouldPersistTaps="handled"
              >
                <View className="mb-5 flex-row items-center justify-between">
                  <Text
                    className="text-xl font-black"
                    style={{ color: colors.text }}
                  >
                    g<Text className="text-g000st-red">000</Text>st
                  </Text>
                  <Pressable
                    accessibilityLabel="Close navigation"
                    accessibilityRole="button"
                    onPress={close}
                    className="h-10 w-10 items-center justify-center"
                  >
                    <Text className="text-2xl" style={{ color: colors.text }}>
                      ×
                    </Text>
                  </Pressable>
                </View>
                {user && (
                  <View
                    className="mb-5 flex-row items-center rounded-2xl p-2"
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 2,
                      borderColor: (activePublicId ?? user.publicId) === user.publicId ? "#C62828" : "transparent",
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View my main profile"
                      onPress={() => visit(`/users/${user.publicId}`)}
                      className="min-w-0 flex-1 flex-row items-center gap-2"
                    >
                      <IdentityKindIcon isPage={false} />
                      <IdentityAvatar avatarUrl={profile?.avatarUrl} name={profile?.displayName || "G"} />
                      <Text
                        numberOfLines={1}
                        className="min-w-0 flex-1 font-black"
                        style={{ color: colors.text }}
                      >
                        {profile?.displayName || user.publicId.slice(0, 8)}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityLabel={(activePublicId ?? user.publicId) === user.publicId ? "Interacting as my profile" : "Switch to my profile"}
                      accessibilityState={{ checked: (activePublicId ?? user.publicId) === user.publicId }}
                      onPress={() => switchTo(user.publicId)}
                      className="h-11 w-11 items-center justify-center"
                    >
                      {(activePublicId ?? user.publicId) === user.publicId ? (
                        <ActiveIdentityCheck />
                      ) : (
                        <Text className="text-xl" style={{ color: colors.text }}>⇄</Text>
                      )}
                    </Pressable>
                  </View>
                )}
                {user && (
                  <View className="mb-5 gap-2">
                    {pages.map((page) => {
                      const pageProfile = pageProfiles[page.publicId];
                      const name = pageProfile?.displayName || page.displayName || "Untitled beacon";
                      return (
                        <View
                          key={page.publicId}
                          className="flex-row items-center rounded-xl"
                          style={{
                            backgroundColor: colors.card,
                            borderWidth: 2,
                            borderColor: activePublicId === page.publicId ? "#C62828" : "transparent",
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`View secondary page ${name}`}
                            onPress={() => visit(`/users/${page.publicId}`)}
                            className="min-w-0 flex-1 flex-row items-center gap-2 px-2 py-3"
                          >
                            <IdentityKindIcon isPage />
                            <IdentityAvatar avatarUrl={pageProfile?.avatarUrl} name={name} />
                            <Text
                              numberOfLines={1}
                              className="min-w-0 flex-1 font-bold"
                              style={{ color: colors.text }}
                            >
                              {name}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="switch"
                            accessibilityLabel={activePublicId === page.publicId ? `Interacting as ${name}` : `Switch to ${name}`}
                            accessibilityState={{
                              checked: activePublicId === page.publicId,
                            }}
                            onPress={() => switchTo(page.publicId)}
                            className="h-12 w-11 items-center justify-center"
                          >
                            {activePublicId === page.publicId ? (
                              <ActiveIdentityCheck />
                            ) : (
                              <Text className="text-xl font-black" style={{ color: colors.text }}>⇄</Text>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => visit("/beacons/new")}
                      className="rounded-xl bg-g000st-red px-4 py-3"
                    >
                      <Text className="text-center font-black text-white">
                        BUILD YOUR BEACON
                      </Text>
                    </Pressable>
                  </View>
                )}
                <View className="gap-2.5">
                  {links.map(([label, href, icon]) => (
                    <Pressable
                      key={href}
                      accessibilityRole="link"
                      onPress={() => visit(href)}
                      className="h-[68px] flex-row items-center gap-4 rounded-[14px] px-4 active:opacity-70"
                      style={{
                        backgroundColor: isDark ? "#3A3B3C" : "#FFFFFF",
                      }}
                    >
                      <SidebarLinkIcon
                        name={icon}
                        color={isDark ? "#FFFFFF" : "#242526"}
                      />
                      <Text
                        className="text-[18px] font-extrabold"
                        style={{ color: isDark ? "#FFFFFF" : "#242526" }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <Pressable
              accessibilityLabel="Close navigation"
              accessibilityRole="button"
              onPress={close}
              className="flex-1"
            />
          </View>
        </Modal>
      </PageEditorContext>
    </SidebarContext>
  );
}
