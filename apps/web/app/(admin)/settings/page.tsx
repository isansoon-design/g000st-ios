"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    appName: "g000st",
    appVersion: "1.0.0",
    maintenanceMode: false,
    enableRegistration: true,
    enableChat: true,
    enableSocial: true,
    maxUploadSize: 50,
    customBrandColor: "#C62828",
    supportEmail: "support@g000st.com",
    privacyUrl: "https://g000st.com/privacy",
    termsUrl: "https://g000st.com/terms",
  });

  const handleChange = (key: keyof typeof settings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Admin Settings</h2>
          <p className="text-gray-600 mt-2">Manage application configuration</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* App Configuration */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              App Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  App Name
                </label>
                <input
                  type="text"
                  value={settings.appName}
                  onChange={(e) => handleChange("appName", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Color
                </label>
                <div className="flex gap-4">
                  <input
                    type="color"
                    value={settings.customBrandColor}
                    onChange={(e) =>
                      handleChange("customBrandColor", e.target.value)
                    }
                    className="h-10 w-20 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.customBrandColor}
                    onChange={(e) =>
                      handleChange("customBrandColor", e.target.value)
                    }
                    placeholder="#000000"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Upload Size (MB)
                </label>
                <input
                  type="number"
                  value={settings.maxUploadSize}
                  onChange={(e) =>
                    handleChange("maxUploadSize", parseInt(e.target.value))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Features
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableChat}
                  onChange={(e) => handleChange("enableChat", e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-900">Enable Chat</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableSocial}
                  onChange={(e) =>
                    handleChange("enableSocial", e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-900">Enable Social Feed</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableRegistration}
                  onChange={(e) =>
                    handleChange("enableRegistration", e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-900">Allow New Registrations</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) =>
                    handleChange("maintenanceMode", e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-900">Maintenance Mode</span>
              </label>
            </div>
          </div>

          {/* Contact & Links */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contact & Legal
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Email
                </label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) =>
                    handleChange("supportEmail", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Privacy Policy URL
                </label>
                <input
                  type="url"
                  value={settings.privacyUrl}
                  onChange={(e) => handleChange("privacyUrl", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terms of Service URL
                </label>
                <input
                  type="url"
                  value={settings.termsUrl}
                  onChange={(e) => handleChange("termsUrl", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
