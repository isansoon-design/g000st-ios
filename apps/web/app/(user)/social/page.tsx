"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Heart, MessageCircle, Share2, MoreVertical } from "lucide-react";

interface Post {
  id: string;
  author: string;
  authorId: string;
  content: string;
  image?: string;
  timestamp: string;
  likes: number;
  comments: number;
  liked: boolean;
}

const mockPosts: Post[] = [
  {
    id: "1",
    author: "Alex Johnson",
    authorId: "user-001",
    content: "Just launched the new g000st feature! 🚀",
    timestamp: "2 hours ago",
    likes: 45,
    comments: 12,
    liked: false,
  },
  {
    id: "2",
    author: "Sarah Miller",
    authorId: "user-002",
    content: "Privacy is not a feature, it's a right 🔐",
    timestamp: "4 hours ago",
    likes: 234,
    comments: 48,
    liked: false,
  },
];

export default function SocialPage() {
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [newPost, setNewPost] = useState("");

  const handlePostCreate = () => {
    if (!newPost.trim()) {
      toast.error("Write something!");
      return;
    }

    const post: Post = {
      id: Date.now().toString(),
      author: "You",
      authorId: "current-user",
      content: newPost,
      timestamp: "now",
      likes: 0,
      comments: 0,
      liked: false,
    };

    setPosts([post, ...posts]);
    setNewPost("");
    toast.success("Posted!");
  };

  const handleLike = (postId: string) => {
    setPosts(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked: !p.liked,
              likes: p.liked ? p.likes - 1 : p.likes + 1,
            }
          : p
      )
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <h2 className="text-lg font-semibold">Social Feed</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Composer */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="space-y-4">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end">
              <button
                onClick={handlePostCreate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Post
              </button>
            </div>
          </div>
        </div>

        {/* Posts Feed */}
        <div className="space-y-4 p-6">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition"
            >
              {/* Post Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{post.author}</p>
                  <p className="text-xs text-gray-500">{post.timestamp}</p>
                </div>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <MoreVertical className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Post Content */}
              <div className="p-4">
                <p className="text-gray-900">{post.content}</p>
                {post.image && (
                  <img
                    src={post.image}
                    alt="Post"
                    className="mt-3 rounded-lg w-full h-auto max-h-96 object-cover"
                  />
                )}
              </div>

              {/* Post Stats */}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 flex justify-between">
                <span>{post.likes} likes</span>
                <span>{post.comments} comments</span>
              </div>

              {/* Post Actions */}
              <div className="px-4 py-3 flex gap-4 border-t border-gray-100">
                <button
                  onClick={() => handleLike(post.id)}
                  className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 py-2 rounded"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      post.liked ? "fill-red-500 text-red-500" : ""
                    }`}
                  />
                  <span className="text-sm">{post.likes}</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 py-2 rounded">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">Comment</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 py-2 rounded">
                  <Share2 className="w-5 h-5" />
                  <span className="text-sm">Share</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
