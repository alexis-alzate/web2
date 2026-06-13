'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useCart } from '../providers/CartProvider';
import { formatCOP } from '@/lib/format';
import { CartIcon, SearchIcon } from './Icons';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { count, total, openCartPreview } = useCart();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setBump(true);
    const timer = setTimeout(() => setBump(false), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const onSearch = (value: string) => {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('q', value);
    else params.delete('q');

    startTransition(() => {
      router.push(`${pathname === '/' ? '/' : '/'}${params.toString() ? `?${params.toString()}` : ''}`);
    });
  };

  return (
    <header className="site-header">
      <Link href="/" className="brand-mark" aria-label="Inicio">
        LUJO<span>URBAN</span>
      </Link>

      <div className="site-search">
        <span className="site-search-icon"><SearchIcon /></span>
        <input
          type="search"
          placeholder="Buscar beats..."
          value={query}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <button type="button" className="cart-toggle" onClick={openCartPreview} aria-label="Abrir carrito">
        <span className={`cart-toggle-icon ${bump ? 'bump' : ''}`}>
          <CartIcon />
          {mounted && count > 0 && <span className="cart-toggle-badge">{count}</span>}
        </span>
        <span className={`cart-toggle-total ${bump ? 'bump' : ''}`}>
          {mounted ? formatCOP(total) : formatCOP(0)}
        </span>
        <span className="cart-toggle-chevron">▾</span>
      </button>
    </header>
  );
}
