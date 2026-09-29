import { useLocalSearchParams } from "expo-router";

import { PostDetailScreen } from "@/features/posts/screens/post-detail-screen";

export default function PostDetailRoute() {
  const { kind, postId } = useLocalSearchParams<{
    kind: string;
    postId: string;
  }>();
  return (
    <PostDetailScreen key={`${kind}:${postId}`} kind={kind} postId={postId} />
  );
}
