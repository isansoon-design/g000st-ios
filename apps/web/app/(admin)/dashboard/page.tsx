"use client";

import { Users, MessageSquare, TrendingUp, Settings } from "lucide-react";

const stats = [
  {
    label: "Total Users",
    value: "1,234",
    icon: Users,
    color: "bg-blue-100 text-blue-600",
  },
  {
    label: "Active Chats",
    value: "456",
    icon: MessageSquare,
    color: "bg-green-100 text-green-600",
  },
  {
    label: "Growth",
    value: "+12%",
    icon: TrendingUp,
    color: "bg-purple-100 text-purple-600",
  },
  {
    label: "System Status",
    value: "Healthy",
    icon: Settings,
    color: "bg-yellow-100 text-yellow-600",
  },
];

export default function DashboardPage() {
  return (
    <div className="h-full p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-2">Welcome to the admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
        </div>
        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-6 py-4">
              <p className="text-gray-900 font-medium">User activity #{i}</p>
              <p className="text-gray-600 text-sm">
                Just now
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
