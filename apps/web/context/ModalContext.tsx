"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface ModalOptions {
  title: string;
  message: string;
  type?: "info" | "success" | "error" | "warning";
  primaryButton?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
  secondaryButton?: {
    label: string;
    onClick: () => void;
  };
}

interface ModalContextType {
  isOpen: boolean;
  options: ModalOptions | null;
  openModal: (options: ModalOptions) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ModalOptions | null>(null);

  const openModal = useCallback((opts: ModalOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setOptions(null);
    }, 200);
  }, []);

  return (
    <ModalContext.Provider value={{ isOpen, options, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
}
