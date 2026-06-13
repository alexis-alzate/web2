'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LicenseType } from '@/lib/types';

export type CartItem = {
  beatId: string;
  slug: string;
  title: string;
  coverUrl: string;
  license: LicenseType;
  price: number;
};

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  isPreviewOpen: boolean;
  openCart: () => void;
  openCartPreview: () => void;
  closeCart: () => void;
  closeCartPreview: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (beatId: string, license: LicenseType) => void;
  isInCart: (beatId: string, license: LicenseType) => boolean;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'lujourban_tienda_cart';

const dedupeByBeat = (cartItems: CartItem[]) => {
  const byBeat = new Map<string, CartItem>();
  cartItems.forEach((item) => byBeat.set(item.beatId, item));
  return Array.from(byBeat.values());
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(dedupeByBeat(parsed));
      }
    } catch {
      // ignora carritos corruptos
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((it) => it.beatId === item.beatId);
      if (existingIndex === -1) return [...prev, item];

      const next = [...prev];
      next[existingIndex] = item;
      return next;
    });
    setIsPreviewOpen(true);
  }, []);

  const removeItem = useCallback((beatId: string, license: LicenseType) => {
    setItems((prev) => prev.filter((it) => !(it.beatId === beatId && it.license === license)));
  }, []);

  const isInCart = useCallback(
    (beatId: string, license: LicenseType) =>
      items.some((it) => it.beatId === beatId && it.license === license),
    [items]
  );

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => {
    setIsPreviewOpen(false);
    setIsOpen(true);
  }, []);
  const openCartPreview = useCallback(() => {
    if (!items.length) {
      setIsOpen(true);
      return;
    }
    setIsOpen(false);
    setIsPreviewOpen(true);
  }, [items.length]);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const closeCartPreview = useCallback(() => setIsPreviewOpen(false), []);

  const total = useMemo(() => items.reduce((sum, it) => sum + it.price, 0), [items]);
  const count = items.length;

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        isPreviewOpen,
        openCart,
        openCartPreview,
        closeCart,
        closeCartPreview,
        addItem,
        removeItem,
        isInCart,
        clear,
        total,
        count
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}
