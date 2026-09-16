"use client";

import { useModal } from "@/context/ModalContext";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function Modal() {
  const { isOpen, options, closeModal } = useModal();
  const [isLoading, setIsLoading] = useState(false);

  const getIcon = () => {
    switch (options?.type) {
      case "success":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "error":
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      default:
        return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const handlePrimaryClick = async () => {
    if (options?.primaryButton?.onClick) {
      setIsLoading(true);
      try {
        await options.primaryButton.onClick();
      } catch (error) {
        console.error("Modal action error:", error);
      } finally {
        setIsLoading(false);
        closeModal();
      }
    } else {
      closeModal();
    }
  };

  const handleSecondaryClick = () => {
    if (options?.secondaryButton?.onClick) {
      options.secondaryButton.onClick();
    }
    closeModal();
  };

  if (!isOpen || !options) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            {getIcon()}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {options.title}
              </h2>
            </div>
          </div>
          <button
            onClick={closeModal}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-600">{options.message}</p>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
          {options.secondaryButton && (
            <button
              onClick={handleSecondaryClick}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
            >
              {options.secondaryButton.label}
            </button>
          )}
          {options.primaryButton && (
            <button
              onClick={handlePrimaryClick}
              disabled={isLoading}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isLoading ? "Loading..." : options.primaryButton.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
