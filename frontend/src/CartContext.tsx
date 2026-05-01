import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  category: string;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  remove: (product_id: string) => void;
  setQty: (product_id: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((item: Omit<CartItem, 'quantity'>, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.product_id === item.product_id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const remove = useCallback((pid: string) => {
    setItems((prev) => prev.filter((p) => p.product_id !== pid));
  }, []);

  const setQty = useCallback((pid: string, qty: number) => {
    setItems((prev) => prev.map((p) => (p.product_id === pid ? { ...p, quantity: Math.max(1, qty) } : p)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return <Ctx.Provider value={{ items, add, remove, setQty, clear, subtotal, count }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
