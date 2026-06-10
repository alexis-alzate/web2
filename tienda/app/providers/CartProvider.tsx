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
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (beatId: string, license: LicenseType) => void;
  isInCart: (beatId: string, license: LicenseType) => boolean;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'lujourban_tienda_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
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
      const exists = prev.some((it) => it.beatId === item.beatId && it.license === item.license);
      if (exists) return prev;
      return [...prev, item];
    });
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
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const total = useMemo(() => items.reduce((sum, it) => sum + it.price, 0), [items]);
  const count = items.length;

  return (
    <CartContext.Provider
      value={{ items, isOpen, openCart, closeCart, addItem, removeItem, isInCart, clear, total, count }}
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
