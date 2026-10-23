// ==================== PAYMENT GATEWAY LAYER ====================
// Single source of truth for payment configuration and gateway SDK loading.
//
// Keys are entered by the merchant in Admin → Settings (stored under the
// "admin_settings" localStorage key) and read AT RUNTIME — no rebuild needed.
// VITE_* environment variables act as fallbacks only.
//
// SECURITY RULE enforced across the app:
//   An order is created/placed ONLY inside a gateway "payment captured" callback
//   (real server-verified confirmation) or after an automatic transaction lookup
//   succeeds. No other code path may place an order.

export const ADMIN_SETTINGS_KEY = "admin_settings";

export type GatewayName = "razorpay" | "phonepe" | "paypal" | "cashfree" | "stripe";

export interface PaymentSettings {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  phonepeKeyId: string;
  cashfreePublishableKey: string;
  paypalClientId: string;
  stripePublicKey: string;
  merchantUpiId: string;
  merchantName: string;
}

const str = (v: any) => (typeof v === "string" ? v.trim() : "");

/** Raw admin settings object (may be partial — merged with safe defaults). */
export function getAdminSettings(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

/** Normalised payment-related settings, merging admin-panel values with env fallbacks. */
export function getPaymentSettings(): PaymentSettings {
  const s = getAdminSettings();
  const env: any = (import.meta as any).env || {};
  return {
    razorpayKeyId: str(s.razorpayKeyId) || str(env.VITE_RAZORPAY_KEY_ID),
    razorpayKeySecret: str(s.razorpayKeySecret) || str(env.VITE_RAZORPAY_KEY_SECRET),
    phonepeKeyId: str(s.phonepeKeyId) || str(env.VITE_PHONEPE_KEY_ID),
    cashfreePublishableKey: str(s.cashfreePublishableKey) || str(env.VITE_CASHFREE_PUBLISHABLE_KEY),
    paypalClientId: str(s.paypalClientId) || str(env.VITE_PAYPAL_CLIENT_ID),
    stripePublicKey: str(s.stripePublicKey) || str(env.VITE_STRIPE_PUBLIC_KEY),
    merchantUpiId: str(s.merchantUpiId),
    merchantName: str(s.merchantName) || str(env.VITE_MERCHANT_NAME) || "Store",
  };
}

const isPlaceholder = (key: string) =>
  !key || /X{6,}|\.\.\.|your-|changeme|placeholder/i.test(key);

/** True when a live Razorpay key has been configured (admin panel or env). */
export function isRazorpayConfigured(): boolean {
  return !isPlaceholder(getPaymentSettings().razorpayKeyId);
}

/** The first gateway that has a key configured, in priority order. */
export function getActiveGateway(): GatewayName | null {
  const s = getPaymentSettings();
  if (!isPlaceholder(s.razorpayKeyId)) return "razorpay";
  if (!isPlaceholder(s.phonepeKeyId)) return "phonepe";
  if (!isPlaceholder(s.cashfreePublishableKey)) return "cashfree";
  if (!isPlaceholder(s.paypalClientId)) return "paypal";
  if (!isPlaceholder(s.stripePublicKey)) return "stripe";
  return null;
}

/** Human-readable label for banners / notices. */
export function gatewayLabel(gw: GatewayName | null): string {
  switch (gw) {
    case "razorpay": return "Razorpay";
    case "phonepe": return "PhonePe";
    case "cashfree": return "Cashfree";
    case "paypal": return "PayPal";
    case "stripe": return "Stripe";
    default: return "Demo Mode";
  }
}

// ==================== SDK SCRIPT LOADER ====================
const sdkLoads = new Map<string, Promise<boolean>>();

/** Load a third-party checkout SDK script once; resolves true on success. */
export function loadScript(id: string, src: string): Promise<boolean> {
  const w = window as any;
  if (w[id]) return Promise.resolve(true);
  if (sdkLoads.has(id)) return sdkLoads.get(id)!;
  const p = new Promise<boolean>((resolve) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve(true);
    el.onerror = () => {
      sdkLoads.delete(id);
      resolve(false);
    };
    document.head.appendChild(el);
  });
  sdkLoads.set(id, p);
  return p;
}

export const loadRazorpaySdk = () => loadScript("Razorpay", "https://checkout.razorpay.com/v1/checkout.js");
export const loadPayPalSdk = (clientId: string) =>
  loadScript("paypal", `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=INR`);

// ==================== UPI TRANSACTION LEDGER ====================
// Shared between checkout (App.tsx) and the admin panel. A record here means the
// money was actually received (gateway webhook or merchant confirmation) — the
// checkout polls this ledger and places the order automatically on a match.
export type UpiTxnRecord = {
  tr: string;              // our txn reference embedded in the UPI link/QR
  status: "success" | "failed";
  rrn?: string;            // bank/UPI RRN recorded as proof of payment
  amt: number;
  vpa: string;
  ts: number;
  source: "gateway-webhook" | "merchant-confirmation";
};

export const UPI_TXN_LEDGER_KEY = "upi_txn_ledger";

export const readUpiTxnLedger = (): UpiTxnRecord[] => {
  try { return JSON.parse(localStorage.getItem(UPI_TXN_LEDGER_KEY) || "[]"); } catch { return []; }
};

export const writeUpiTxnLedger = (recs: UpiTxnRecord[]) => {
  try { localStorage.setItem(UPI_TXN_LEDGER_KEY, JSON.stringify(recs.slice(-200))); } catch {}
};

/** Record a confirmed payment and instantly notify every open tab. */
export const recordUpiTxnSuccess = (rec: Omit<UpiTxnRecord, "ts" | "source"> & Partial<Pick<UpiTxnRecord, "source">>) => {
  const recs = readUpiTxnLedger();
  const existing = recs.findIndex((r) => r.tr === rec.tr);
  const full: UpiTxnRecord = { ...rec, ts: Date.now(), source: rec.source || "merchant-confirmation" };
  if (existing >= 0) recs[existing] = full; else recs.push(full);
  writeUpiTxnLedger(recs);
  try { window.dispatchEvent(new CustomEvent("upi-txn-recorded", { detail: full })); } catch {}
  try { new BroadcastChannel("upi-txn-ledger").postMessage(full); } catch {}
};

export const findUpiTxnByTr = (tr: string): UpiTxnRecord | null =>
  readUpiTxnLedger().find((r) => r.tr === tr && r.status === "success") || null;

// ==================== RAZORPAY ORDER CREATION (optional backend) ====================
// Best practice: create the Razorpay Order on YOUR server (order_id + signature
// verification there). If the merchant supplies an endpoint, we use it; otherwise
// we fall back to the standard keyless checkout widget, whose `payment.captured`
// event is still emitted only on genuine, gateway-verified capture.
export const getRzpOrdersEndpoint = (): string => {
  const s = getAdminSettings();
  const url = str(s.razorpayOrdersUrl) || str((import.meta as any).env?.VITE_RZP_ORDERS_URL) || "";
  return /^https?:\/\//.test(url) ? url.replace(/\/+$/, "") : "";
};

export async function createRazorpayOrder(amountInr: number): Promise<{ id: string; amount: number; currency: string } | null> {
  const base = getRzpOrdersEndpoint();
  if (!base) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${base}/order/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: "INR" }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const id = data?.id || data?.order_id || data?.razorpay_order_id;
    if (!id) return null;
    return { id: String(id), amount: Number(data?.amount) || Math.round(amountInr * 100), currency: data?.currency || "INR" };
  } catch {
    return null;
  }
}
