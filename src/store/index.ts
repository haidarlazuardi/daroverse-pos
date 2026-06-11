import { create } from 'zustand';

// ─── Auth Store ──────────────────────────────────────
interface AuthUser {
  userId: string;
  email: string;
  role: 'ADMIN' | 'CASHIER';
  outletId: string | null;
  name: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));

// ─── Cart Store (POS) ────────────────────────────────
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

interface SplitBillPart {
  id: string;
  label: string;
  itemIds: string[];
  paid: boolean;
}

interface CartStore {
  items: CartItem[];
  notes: string;
  discountType: 'none' | 'percent' | 'fixed';
  discountValue: number;
  splitBill: SplitBillPart[];
  splitMode: boolean;

  addItem: (product: { id: string; name: string; price: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemNotes: (productId: string, notes: string) => void;
  setOrderNotes: (notes: string) => void;
  setDiscount: (type: 'none' | 'percent' | 'fixed', value: number) => void;
  clear: () => void;

  enableSplit: (parts: number) => void;
  disableSplit: () => void;
  assignItemToSplit: (productId: string, splitId: string) => void;
  markSplitPaid: (splitId: string) => void;

  subtotal: () => number;
  discountAmount: () => number;
  taxableAmount: () => number;
  tax: () => number;
  total: () => number;
  itemCount: () => number;
  splitTotal: (splitId: string) => number;
}

const TAX_RATE = 0.11;

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  notes: '',
  discountType: 'none',
  discountValue: 0,
  splitBill: [],
  splitMode: false,

  addItem: (product) => {
    const items = get().items;
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      set({ items: items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i) });
    } else {
      set({ items: [...items, { productId: product.id, name: product.name, price: product.price, quantity: 1, notes: '' }] });
    }
  },
  removeItem: (productId) => set({ items: get().items.filter(i => i.productId !== productId) }),
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) set({ items: get().items.filter(i => i.productId !== productId) });
    else set({ items: get().items.map(i => i.productId === productId ? { ...i, quantity } : i) });
  },
  updateItemNotes: (productId, notes) => {
    set({ items: get().items.map(i => i.productId === productId ? { ...i, notes } : i) });
  },
  setOrderNotes: (notes) => set({ notes }),
  setDiscount: (type, value) => set({ discountType: type, discountValue: value }),
  clear: () => set({ items: [], notes: '', discountType: 'none', discountValue: 0, splitBill: [], splitMode: false }),

  enableSplit: (parts) => {
    const splits: SplitBillPart[] = [];
    for (let i = 0; i < parts; i++) {
      splits.push({ id: `split-${i}`, label: `Bill ${i + 1}`, itemIds: [], paid: false });
    }
    set({ splitBill: splits, splitMode: true });
  },
  disableSplit: () => set({ splitBill: [], splitMode: false }),
  assignItemToSplit: (productId, splitId) => {
    const splits = get().splitBill.map(s => ({
      ...s,
      itemIds: s.id === splitId
        ? (s.itemIds.includes(productId) ? s.itemIds.filter(id => id !== productId) : [...s.itemIds, productId])
        : s.itemIds.filter(id => id !== productId),
    }));
    set({ splitBill: splits });
  },
  markSplitPaid: (splitId) => {
    set({ splitBill: get().splitBill.map(s => s.id === splitId ? { ...s, paid: true } : s) });
  },

  subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  discountAmount: () => {
    const { discountType, discountValue } = get();
    const sub = get().subtotal();
    if (discountType === 'percent') return sub * (discountValue / 100);
    if (discountType === 'fixed') return Math.min(discountValue, sub);
    return 0;
  },
  taxableAmount: () => get().subtotal() - get().discountAmount(),
  tax: () => get().taxableAmount() * TAX_RATE,
  total: () => get().taxableAmount() + get().tax(),
  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  splitTotal: (splitId) => {
    const split = get().splitBill.find(s => s.id === splitId);
    if (!split) return 0;
    const splitItems = get().items.filter(i => split.itemIds.includes(i.productId));
    const sub = splitItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return sub + sub * TAX_RATE;
  },
}));
