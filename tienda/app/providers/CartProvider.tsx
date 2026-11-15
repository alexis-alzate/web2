'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { LicenseType } from '@/lib/types';

export type CartItem = {
  beatId: string;
  slug: string;
  title: string;
  coverUrl: string;
  license: LicenseType;
  price: number;
  // Tienda (productor) a la que pertenece el beat. null = beat sin tienda propia.
  producerSlug?: string | null;
};

type CartContextValue = {
  // Solo los items de la tienda que se está viendo (o todos en el catálogo general).
  items: CartItem[];
  // Slug del productor cuya tienda se está viendo; null en el catálogo general.
  scopeSlug: string | null;
  setScopeOverride: (slug: string | null | undefined) => void;
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

// Tienda de un productor: /productor/<slug>. Fuera de ahí no hay alcance
// (undefined = catálogo general, se ve todo el carrito).
const PRODUCER_PATH = /^\/productor\/([a-z0-9]+(?:-[a-z0-9]+)*)/;
const scopeFromPath = (pathname: string | null): string | undefined => {
  const match = pathname ? PRODUCER_PATH.exec(pathname) : null;
  return match ? match[1] : undefined;
};

const dedupeByBeat = (cartItems: CartItem[]) => {
  const byBeat = new Map<string, CartItem>();
  cartItems.forEach((item) => byBeat.set(item.beatId, item));
  return Array.from(byBeat.values());
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [allItems, setItems] = useState<CartItem[]>([]);
  // Las páginas que no están bajo /productor/<slug> (p. ej. el detalle de un beat)
  // fijan aquí la tienda a la que pertenecen, con useCartScope.
  const [scopeOverride, setScopeOverride] = useState<string | null | undefined>(undefined);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allItems));
  }, [allItems, hydrated]);

  // undefined = todo el carrito; string = solo esa tienda; null = beats sin tienda.
  const scope = scopeFromPath(pathname) ?? scopeOverride;
  const items = useMemo(
    () => (scope === undefined ? allItems : allItems.filter((it) => (it.producerSlug ?? null) === scope)),
    [allItems, scope]
  );

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
      allItems.some((it) => it.beatId === beatId && it.license === license),
    [allItems]
  );

  // Vacía solo lo que se está viendo: pagar en una tienda no toca el carrito de otra.
  const clear = useCallback(() => {
    setItems((prev) =>
      scope === undefined ? [] : prev.filter((it) => (it.producerSlug ?? null) !== scope)
    );
  }, [scope]);
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
        scopeSlug: scope ?? null,
        setScopeOverride,
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

// Para páginas que no cuelgan de /productor/<slug> (detalle de un beat): el carrito
// y el header se limitan a la tienda del productor de ese beat.
export function useCartScope(slug: string | null) {
  const { setScopeOverride } = useCart();
  useEffect(() => {
    setScopeOverride(slug);
    return () => setScopeOverride(undefined);
  }, [slug, setScopeOverride]);
}
