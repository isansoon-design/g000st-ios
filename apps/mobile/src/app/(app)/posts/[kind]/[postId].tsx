import { Redirect, useLocalSearchParams } from "expo-router";

import { MARKET_POST_DISCUSSION_ENABLED } from "@/domain/market/features";
import { PostDetailScreen } from "@/features/posts/screens/post-detail-screen";

export default function PostDetailRoute() {
  const { kind, postId } = useLocalSearchParams<{
    kind: string;
    postId: string;
  }>();
  if (kind === "market" && !MARKET_POST_DISCUSSION_ENABLED) {
    return <Redirect href="/(app)/(tabs)/trading" />;
  }
  return (
    <PostDetailScreen key={`${kind}:${postId}`} kind={kind} postId={postId} />
  );
}
