"use client";

import Link from "next/link";
import { MessageCircle, Users, Lock } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="space-y-4">
          <div className="inline-block">
            <h1 className="text-5xl font-bold tracking-tighter">
              <span className="text-gray-900">g</span>
              <span className="text-red-600">000</span>
              <span className="text-gray-900">st</span>
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Private Social Chat</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 py-8">
          <div className="flex flex-col items-center gap-2">
            <MessageCircle className="w-8 h-8 text-blue-500" />
            <p className="text-sm font-medium">Encrypted Chat</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Users className="w-8 h-8 text-green-500" />
            <p className="text-sm font-medium">Social Feed</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Lock className="w-8 h-8 text-purple-500" />
            <p className="text-sm font-medium">Privacy First</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/login"
            className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-8 py-3 bg-white text-gray-900 border-2 border-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Register
          </Link>
        </div>

        {/* Footer */}
        <div className="text-sm text-gray-500 pt-8">
          <p>© 2026 g000st. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
