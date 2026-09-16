"use client";

import Link from "next/link";
import { Users, Settings, LogOut, Menu } from "lucide-react";
import { useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">
            <span className="text-gray-900">g</span>
            <span className="text-red-600">000</span>
            <span className="text-gray-900">st</span>
            <span className="text-gray-600 ml-2">Admin</span>
          </h1>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav
          className={`${
            isSidebarOpen ? "w-64" : "w-0"
          } bg-white border-r border-gray-200 overflow-hidden transition-all duration-200`}
        >
          <div className="p-6 space-y-4">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700"
            >
              <Settings className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700"
            >
              <Users className="w-5 h-5" />
              <span>Users</span>
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
