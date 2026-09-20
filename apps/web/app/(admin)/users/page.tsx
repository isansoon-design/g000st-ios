"use client";

import { useConfirmModal } from "@/context/ConfirmModalContext";
import { Search, Trash2, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface User {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  joinedAt: string;
  posts: number;
  lastActive: string;
}

const mockUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    status: "active",
    joinedAt: "2024-01-15",
    posts: 42,
    lastActive: "2 hours ago",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    status: "active",
    joinedAt: "2024-02-20",
    posts: 85,
    lastActive: "10 mins ago",
  },
  {
    id: "3",
    name: "Bob Wilson",
    email: "bob@example.com",
    status: "suspended",
    joinedAt: "2024-03-10",
    posts: 12,
    lastActive: "5 days ago",
  },
  {
    id: "4",
    name: "Alice Brown",
    email: "alice@example.com",
    status: "active",
    joinedAt: "2024-04-05",
    posts: 156,
    lastActive: "1 hour ago",
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const { confirm } = useConfirmModal();

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelect = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSuspend = (userId: string) => {
    setUsers(
      users.map((u) =>
        u.id === userId
          ? { ...u, status: u.status === "active" ? "suspended" : "active" }
          : u
      )
    );
    toast.success("User status updated");
  };

  const handleDelete = async (userId: string) => {
    const confirmed = await confirm({
      title: "Delete user?",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      confirmLabel: "Delete",
      isDangerous: true,
    });
    if (confirmed) {
      setUsers(users.filter((u) => u.id !== userId));
      toast.success("User deleted");
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Users Management</h2>
          <span className="text-sm text-gray-600">{users.length} total users</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 w-12">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(new Set(users.map((u) => u.id)));
                    } else {
                      setSelectedUsers(new Set());
                    }
                  }}
                  className="rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Email
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Posts
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Last Active
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => toggleUserSelect(user.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {user.name}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-3 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {user.joinedAt}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">{user.posts}</td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {user.lastActive}
                </td>
                <td className="px-6 py-3 text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSuspend(user.id)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600"
                      title={
                        user.status === "active" ? "Suspend" : "Activate"
                      }
                    >
                      {user.status === "active" ? (
                        <UserX className="w-5 h-5" />
                      ) : (
                        <UserCheck className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => void handleDelete(user.id)}
                      className="p-1 hover:bg-gray-100 rounded text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
