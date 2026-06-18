import { create } from 'zustand';

// ─── Auth Store ──────────────────────────────────────
export type Role = 'SUPER_ADMIN' | 'CASHIER';

interface AuthUser {
  userId: string;
  email: string;
  role: Role;
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
        set({ user: JSON.parse(userStr), token });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));

// ─── Cart Store (POS) ────────────────────────────────
// A "line" is one cart row. Two rows of the same product with different
// modifiers stay separate; identical ones merge (qty++) on add.

export interface SelectedModifier {
  groupName: string;
  optionName: string;
  effect: 'ADJUST' | 'ADD';
  targetIngredientId: string | null;
  multiplier?: number | null;
  addQty?: number | null;
  priceDelta: number;
}

export interface CartLine {
  lineId: string;
  productId: string;
  name: string;
  basePrice: number;
  station: 'FOOD' | 'DRINK';
  takeawayCharge: number;
  quantity: number;
  notes: string;
  modifiers: SelectedModifier[];
}

export type OrderType = 'DINE_IN' | 'TAKEAWAY';

const sig = (productId: string, mods: SelectedModifier[]) =>
  productId + '|' + mods.map((m) => `${m.groupName}:${m.optionName}`).sort().join(',');

export const lineUnitPrice = (line: Pick<CartLine, 'basePrice' | 'modifiers'>) =>
  line.basePrice + line.modifiers.reduce((s, m) => s + (m.priceDelta || 0), 0);

interface CartStore {
  lines: CartLine[];
  orderType: OrderType;
  taxEnabled: boolean;
  serviceEnabled: boolean;
  taxRate: number;
  serviceRate: number;
  discount: number;
  discountId: string | null;
  discountLabel: string | null;
  redeemPoints: number;
  redeemValue: number;
  notes: string;
  billName: string;

  addLine: (p: { productId: string; name: string; basePrice: number; station: 'FOOD' | 'DRINK'; takeawayCharge: number; modifiers?: SelectedModifier[]; notes?: string }) => void;
  setLineModifiers: (lineId: string, modifiers: SelectedModifier[]) => void;
  setLineNotes: (lineId: string, notes: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;

  setOrderType: (t: OrderType) => void;
  setTaxEnabled: (v: boolean) => void;
  setServiceEnabled: (v: boolean) => void;
  setRates: (taxRate: number, serviceRate: number, redeemValue: number) => void;
  setDiscount: (amount: number, id: string | null, label: string | null) => void;
  setRedeemPoints: (n: number) => void;
  setNotes: (n: string) => void;
  setBillName: (n: string) => void;
  clear: () => void;

  subtotal: () => number;
  takeawayTotal: () => number;
  tax: () => number;
  service: () => number;
  total: () => number;
  itemCount: () => number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export const useCartStore = create<CartStore>((set, get) => ({
  lines: [],
  orderType: 'DINE_IN',
  taxEnabled: false,
  serviceEnabled: false,
  taxRate: 0.1,
  serviceRate: 0.05,
  discount: 0,
  discountId: null,
  discountLabel: null,
  redeemPoints: 0,
  redeemValue: 100,
  notes: '',
  billName: '',

  addLine: (p) => {
    const mods = p.modifiers || [];
    const lines = get().lines;
    const s = sig(p.productId, mods);
    const existing = lines.find((l) => sig(l.productId, l.modifiers) === s);
    if (existing) {
      set({ lines: lines.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l)) });
    } else {
      set({
        lines: [...lines, {
          lineId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          productId: p.productId, name: p.name, basePrice: p.basePrice,
          station: p.station, takeawayCharge: p.takeawayCharge,
          quantity: 1, notes: p.notes || '', modifiers: mods,
        }],
      });
    }
  },
  setLineModifiers: (lineId, modifiers) =>
    set({ lines: get().lines.map((l) => (l.lineId === lineId ? { ...l, modifiers } : l)) }),
  setLineNotes: (lineId, notes) =>
    set({ lines: get().lines.map((l) => (l.lineId === lineId ? { ...l, notes } : l)) }),
  updateQuantity: (lineId, quantity) => {
    if (quantity <= 0) set({ lines: get().lines.filter((l) => l.lineId !== lineId) });
    else set({ lines: get().lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)) });
  },
  removeLine: (lineId) => set({ lines: get().lines.filter((l) => l.lineId !== lineId) }),

  setOrderType: (orderType) => set({ orderType }),
  setTaxEnabled: (taxEnabled) => set({ taxEnabled }),
  setServiceEnabled: (serviceEnabled) => set({ serviceEnabled }),
  setRates: (taxRate, serviceRate, redeemValue) => set({ taxRate, serviceRate, redeemValue }),
  setDiscount: (discount, discountId, discountLabel) => set({ discount, discountId, discountLabel }),
  setRedeemPoints: (redeemPoints) => set({ redeemPoints }),
  setNotes: (notes) => set({ notes }),
  setBillName: (billName) => set({ billName }),
  clear: () => set({
    lines: [], orderType: 'DINE_IN', taxEnabled: false, serviceEnabled: false,
    discount: 0, discountId: null, discountLabel: null, redeemPoints: 0, notes: '', billName: '',
  }),

  subtotal: () => round(get().lines.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0)),
  takeawayTotal: () => {
    if (get().orderType !== 'TAKEAWAY') return 0;
    return round(get().lines.reduce((s, l) => s + (l.station === 'FOOD' ? l.takeawayCharge * l.quantity : 0), 0));
  },
  tax: () => (get().taxEnabled ? round(get().subtotal() * get().taxRate) : 0),
  service: () => (get().serviceEnabled ? round(get().subtotal() * get().serviceRate) : 0),
  total: () => {
    const g = get();
    const redeem = g.redeemPoints * g.redeemValue;
    return Math.max(0, round(g.subtotal() + g.tax() + g.service() + g.takeawayTotal() - g.discount - redeem));
  },
  itemCount: () => get().lines.reduce((s, l) => s + l.quantity, 0),
}));
