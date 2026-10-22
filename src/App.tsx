import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import emailjs from "@emailjs/browser";
import AdminPanel from "./AdminPanel";
import { generateOrderEmailHTML, generateOrderEmailText } from "./emailTemplate";

// ==================== IMAGES ====================
const IMAGES = {
  hero: "https://image.qwenlm.ai/generated-images/133e1ad1-9c44-4161-9130-d44a95a99f86/_result.png",
  product1: "https://image.qwenlm.ai/generated-images/0a1804b5-c61a-4df6-8dac-e38469533723/_result.png",
  product2: "https://image.qwenlm.ai/generated-images/6cd469dc-fd2d-4890-a660-3a4faed1ba4f/_result.png",
  product3: "https://image.qwenlm.ai/generated-images/641e1827-8b84-47e1-9bf7-b3ffa08cf423/_result.png",
  product4: "https://image.qwenlm.ai/generated-images/e9c3ba9b-88ca-42d0-87de-62a0579273e1/_result.png",
  product5: "https://image.qwenlm.ai/generated-images/ffff3244-1707-48fa-9f6d-e57d89cc5726/_result.png",
  product6: "https://image.qwenlm.ai/generated-images/870cef3d-b194-40f8-9d6e-9655e69108b4/_result.png",
};

// ==================== PRODUCTS ====================
const products = [
  { id: 1, name: "Ocean Wave Resin Art", price: 8500, medium: "Epoxy Resin on Wood", size: '24" × 18"', image: IMAGES.product1, tag: "Bestseller", description: "Deep blue ocean wave with white foam details, glossy finish." },
  { id: 2, name: "Botanical Flower Preserve", price: 6500, medium: "Clear Resin with Flowers", size: '12" × 12"', image: IMAGES.product2, tag: "New", description: "Real pressed wildflowers preserved in crystal-clear resin." },
  { id: 3, name: "Geode Crystal Art", price: 12000, medium: "Resin with Metallic Pigments", size: '18" × 18"', image: IMAGES.product3, tag: "Exclusive", description: "Geode-inspired crystalline formations with gold accents." },
  { id: 4, name: "Galaxy Nebula Pour", price: 9500, medium: "Resin with Glitter", size: '20" × 16"', image: IMAGES.product4, tag: "Featured", description: "Cosmic deep-space inspired swirls with starry glitter." },
  { id: 5, name: "Mountain Sunset Landscape", price: 11000, medium: "Layered Resin Art", size: '24" × 16"', image: IMAGES.product5, tag: "Limited", description: "Scenic mountain silhouette with sunset lake reflection." },
  { id: 6, name: "Marble Coaster Set (4)", price: 3500, medium: "Resin Coasters", size: '4" × 4" each', image: IMAGES.product6, tag: "Gift Set", description: "Set of 4 handmade marble-effect resin coasters." },
];

// ==================== UPI APPS (deep links to open & pay directly) ====================
const UPI_APPS = [
  { id: "gpay", name: "Google Pay", icon: "fab fa-google-pay", color: "text-blue-300", bg: "bg-blue-500/20", link: "gpupi://pay", badge: "GPay" },
  { id: "phonepe", name: "PhonePe", icon: "fas fa-mobile-alt", color: "text-purple-300", bg: "bg-purple-500/20", link: "phonepe://pay", badge: "PhonePe" },
  { id: "paytm", name: "Paytm", icon: "fas fa-wallet", color: "text-indigo-300", bg: "bg-indigo-500/20", link: "paytmmp://pay", badge: "Paytm" },
  { id: "bhim", name: "BHIM", icon: "fas fa-rupee-sign", color: "text-orange-300", bg: "bg-orange-500/20", link: "upi://pay", badge: "BHIM" },
  { id: "amazonpay", name: "Amazon Pay", icon: "fab fa-amazon", color: "text-yellow-300", bg: "bg-yellow-500/20", link: "amazonpay://pay", badge: "AmznPay" },
  { id: "any", name: "Any UPI App", icon: "fas fa-th-large", color: "text-cyan-300", bg: "bg-cyan-500/20", link: "upi://pay", badge: "Any" },
];

// Build a standard UPI deep link (works with any UPI app on the device).
// NOTE: per the UPI spec, app-specific links must still carry the full pa/am/cu/tn
// parameters, so we always start from "upi://pay" and only prefix the app scheme.
const buildUpiDeepLink = (amount: number, appLink?: string) => {
  const savedSettings = JSON.parse(localStorage.getItem("admin_settings") || "{}");
  const merchantVpa = savedSettings.merchantUpiId || "resincraft@upi"; // set your real UPI ID in Admin > Settings
  const params = new URLSearchParams({
    pa: merchantVpa,
    pn: savedSettings.merchantName || "ResinCraft",
    tr: "ResinCraft-" + Date.now(), // transaction reference (recommended by NPCI spec)
    am: String(amount),
    cu: "INR",
    tn: "ResinCraft Order Payment",
  });
  const base = "upi://pay";
  // If an app-specific scheme is configured (e.g. "phonepe://pay"), use it but keep params
  const scheme = (appLink || base).split("?")[0];
  return `${scheme}?${params.toString()}`;
};

// Reliable way to launch a UPI deep link without breaking the checkout SPA:
// hidden iframe first (opens the native app without navigating away), then fall
// back to a new tab, and finally same-tab navigation as a last resort.
const openUpiLink = (link: string): boolean => {
  try {
    if (!/^upi:\/\/|^gpupi:\/\/|^phonepe:\/\/|^paytmmp:\/\/|^amazonpay:\/\//.test(link)) return false;
    let frame = document.getElementById("upi-deeplink-frame") as HTMLIFrameElement | null;
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "upi-deeplink-frame";
      frame.style.display = "none";
      document.body.appendChild(frame);
    }
    frame.src = link;
    // Fallback: if no app handled the scheme within a moment, try a new tab
    setTimeout(() => {
      try { window.open(link, "_blank"); } catch { /* popup blocked */ }
    }, 600);
    return true;
  } catch {
    return false;
  }
};

// Desktop users can't launch mobile UPI apps — show a scannable QR code instead.
const upiQrUrl = (link: string) => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(link)}`;

// ==================== TYPES ====================
interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

interface ShippingInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface PaymentInfo {
  method: "upi" | "card" | "netbanking" | "wallet";
  upiMode: "app" | "manual";
  upiApp?: string;
  upiId?: string;
  cardNumber?: string;
  cardName?: string;
  cardExpiry?: string;
  cardCvv?: string;
  bank?: string;
  wallet?: string;
}

interface OrderDetails {
  orderId: string;
  items: CartItem[];
  shipping: ShippingInfo;
  payment: PaymentInfo;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  date: string;
  paymentStatus: "pending" | "paid" | "failed";
}

// Saved locally while the customer is away completing the UPI app payment.
// The order is NOT placed until the customer confirms the payment succeeded.
const PENDING_UPI_ORDER_KEY = "pending_upi_order";

// ==================== CONTEXTS ====================
interface CartContextType {
  cart: CartItem[];
  addToCart: (product: typeof products[0]) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

interface ToastContextType {
  addToast: (msg: string, type?: "success" | "info" | "error") => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ==================== PROVIDERS ====================
function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const addToCart = useCallback((product: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCart((prev) => prev.map((item) => item.id === id ? { ...item, quantity: qty } : item));
    }
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice, isCartOpen, setIsCartOpen, isCheckoutOpen, setIsCheckoutOpen }}>
      {children}
    </CartContext.Provider>
  );
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "info" | "error" }>>([]);
  const counter = useRef(0);

  const addToast = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className={`glass-card rounded-xl px-5 py-3 flex items-center gap-3 min-w-[280px] shadow-2xl ${
                toast.type === "success" ? "border-indigo-500/30" : toast.type === "error" ? "border-red-500/30" : "border-pink-500/30"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                toast.type === "success" ? "bg-indigo-500/20" : toast.type === "error" ? "bg-red-500/20" : "bg-pink-500/20"
              }`}>
                <i className={`fas ${toast.type === "success" ? "fa-check" : toast.type === "error" ? "fa-times" : "fa-info"} text-sm ${
                  toast.type === "success" ? "text-indigo-400" : toast.type === "error" ? "text-red-400" : "text-pink-400"
                }`}></i>
              </div>
              <p className="text-sm text-gray-200">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ==================== HELPERS ====================
const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
};

const generateOrderId = () => {
  return "RC" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
};

// ==================== ORDER PERSISTENCE (called ONLY after a successful payment) ====================
// An order is created/placed automatically the moment payment succeeds — the customer never
// has to click "Place Order" twice. The order is written to the admin orders list, mirrored to
// Supabase (if configured) and marked as paid so it can never be recorded without payment.
const createPlacedOrder = async (order: OrderDetails) => {
  const existingOrders = JSON.parse(localStorage.getItem("admin_orders") || "[]");
  // Guard against double-placing the same order
  if (existingOrders.some((o: any) => o.orderId === order.orderId)) return;

  const newOrder = {
    orderId: order.orderId,
    customerName: order.shipping.fullName,
    email: order.shipping.email,
    phone: order.shipping.phone,
    items: order.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
    total: order.total,
    status: "confirmed" as const, // auto-confirmed because payment is already done
    paymentMethod: order.payment.method,
    paymentStatus: "paid",
    date: order.date,
    address: `${order.shipping.address}, ${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}`,
  };

  existingOrders.push(newOrder);
  localStorage.setItem("admin_orders", JSON.stringify(existingOrders));

  // Mirror to Supabase when it is configured (non-blocking, keeps demo mode working)
  try {
    const supabaseConfigured =
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      !String(import.meta.env.VITE_SUPABASE_URL).includes("your-project.supabase.co");
    if (supabaseConfigured) {
      const { db } = await import("./lib/supabase");
      await db.orders.create({
        order_number: order.orderId,
        customer_name: order.shipping.fullName,
        customer_email: order.shipping.email,
        customer_phone: order.shipping.phone,
        shipping_address: newOrder.address,
        items: newOrder.items,
        total_amount: order.total,
        status: "processing",
        payment_method: order.payment.method,
        payment_status: "completed",
      });
    }
  } catch (err) {
    console.warn("Supabase order sync skipped:", err);
  }
};

// ==================== ANIMATION VARIANTS ====================
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const fadeInScale = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -100 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const slideInRight = {
  hidden: { opacity: 0, x: 100 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
};

// ==================== NAVBAR ====================
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems, setIsCartOpen } = useCart();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-[#0f0f23]/90 backdrop-blur-xl border-b border-indigo-500/10" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <motion.a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">✦</span>
          </div>
          <span className="text-xl font-bold tracking-tight">RESIN<span className="text-gradient">CRAFT</span></span>
        </motion.a>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Collection", target: "collection" },
            { label: "Featured", target: "featured" },
            { label: "About", target: "about" },
            { label: "Process", target: "process" },
            { label: "Contact", target: "contact" },
          ].map((item) => (
            <a
              key={item.label}
              href={`#${item.target}`}
              onClick={(e) => handleNavClick(e, item.target)}
              className="text-sm text-gray-300 hover:text-indigo-300 transition-colors line-reveal pb-1"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button onClick={() => { const el = document.getElementById("collection"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="text-sm text-gray-300 hover:text-indigo-300 transition-colors">
            <i className="fas fa-search"></i>
          </button>
          <button onClick={() => setIsCartOpen(true)} className="text-sm text-gray-300 hover:text-indigo-300 transition-colors relative">
            <i className="fas fa-shopping-bag"></i>
            {totalItems > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                {totalItems}
              </motion.span>
            )}
          </button>
          <button onClick={() => { const el = document.getElementById("collection"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="btn-primary px-5 py-2 rounded-full text-sm font-medium text-white">
            Shop Now
          </button>
        </div>

        <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
          <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"} text-xl`}></i>
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="md:hidden bg-[#0f0f23]/98 backdrop-blur-xl border-t border-indigo-500/10">
            <div className="px-6 py-6 flex flex-col gap-4">
              {[
                { label: "Collection", target: "collection" },
                { label: "Featured", target: "featured" },
                { label: "About", target: "about" },
                { label: "Process", target: "process" },
                { label: "Contact", target: "contact" },
              ].map((item) => (
                <a key={item.label} href={`#${item.target}`} onClick={(e) => handleNavClick(e, item.target)} className="text-lg text-gray-300 hover:text-indigo-300">
                  {item.label}
                </a>
              ))}
              <button onClick={() => { setMenuOpen(false); setIsCartOpen(true); }} className="text-left text-lg text-gray-300 hover:text-indigo-300 flex items-center gap-2">
                <i className="fas fa-shopping-bag"></i> Cart ({totalItems})
              </button>
              <button onClick={() => { setMenuOpen(false); const el = document.getElementById("collection"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="btn-primary px-5 py-3 rounded-full text-sm font-medium text-white mt-2">
                Shop Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ==================== CART SIDEBAR ====================
function CartSidebar() {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, totalPrice, totalItems, clearCart, setIsCheckoutOpen } = useCart();
  const { addToast } = useToast();

  const handleProceedToCheckout = () => {
    if (cart.length === 0) {
      addToast("Your cart is empty!", "error");
      return;
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0f0f23] border-l border-indigo-500/10 z-[70] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-xl font-bold">Your Cart ({totalItems})</h2>
              <button onClick={() => setIsCartOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <i className="fas fa-times text-gray-400"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <i className="fas fa-shopping-bag text-4xl text-gray-400 mb-4"></i>
                  <p className="text-gray-300">Your cart is empty</p>
                  <button onClick={() => { setIsCartOpen(false); const el = document.getElementById("collection"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="btn-primary px-6 py-2 rounded-full text-sm font-medium text-white mt-4">
                    Browse Collection
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 100 }} className="glass-card rounded-xl p-4 flex gap-4">
                      <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <p className="text-indigo-300 font-semibold text-sm mt-1">{formatINR(item.price)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20 transition-colors">−</button>
                          <span className="text-sm w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20 transition-colors">+</button>
                          <button onClick={() => { removeFromCart(item.id); addToast(`${item.name} removed from cart`, "info"); }} className="ml-auto text-gray-300 hover:text-red-400 transition-colors text-sm">
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-white/5 p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-xl font-bold text-gradient">{formatINR(totalPrice)}</span>
                </div>
                <p className="text-xs text-gray-300">Free shipping across India on orders above ₹5,000</p>
                <button onClick={handleProceedToCheckout} className="btn-primary w-full py-3.5 rounded-full text-white font-medium">
                  Proceed to Checkout
                </button>
                <button onClick={() => { clearCart(); addToast("Cart cleared", "info"); }} className="w-full py-2 text-sm text-gray-300 hover:text-white transition-colors">
                  Clear Cart
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ==================== CHECKOUT MODAL ====================
function CheckoutModal() {
  const { cart, isCheckoutOpen, setIsCheckoutOpen, clearCart, totalPrice } = useCart();
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [shipping, setShipping] = useState<ShippingInfo>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });
  const [payment, setPayment] = useState<PaymentInfo>({ method: "upi", upiMode: "app" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = totalPrice;
  const shippingCost = subtotal >= 5000 ? 0 : 299;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shippingCost + tax;

  const validateShipping = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!shipping.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!shipping.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) newErrors.email = "Invalid email format";
    if (!shipping.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[6-9]\d{9}$/.test(shipping.phone)) newErrors.phone = "Invalid Indian phone number";
    if (!shipping.address.trim()) newErrors.address = "Address is required";
    if (!shipping.city.trim()) newErrors.city = "City is required";
    if (!shipping.state.trim()) newErrors.state = "State is required";
    if (!shipping.pincode.trim()) newErrors.pincode = "Pincode is required";
    else if (!/^\d{6}$/.test(shipping.pincode)) newErrors.pincode = "Invalid pincode (6 digits)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (payment.method === "upi") {
      if (payment.upiMode === "app") {
        if (!payment.upiApp) newErrors.upiApp = "Please select a UPI app to pay with";
      } else {
        if (!payment.upiId?.trim()) newErrors.upiId = "UPI ID is required";
        else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(payment.upiId)) newErrors.upiId = "Invalid UPI ID format";
      }
    } else if (payment.method === "card") {
      if (!payment.cardNumber?.trim()) newErrors.cardNumber = "Card number is required";
      else if (!/^\d{16}$/.test(payment.cardNumber.replace(/\s/g, ""))) newErrors.cardNumber = "Invalid card number (16 digits)";
      if (!payment.cardName?.trim()) newErrors.cardName = "Cardholder name is required";
      if (!payment.cardExpiry?.trim()) newErrors.cardExpiry = "Expiry date is required";
      else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.cardExpiry)) newErrors.cardExpiry = "Invalid format (MM/YY)";
      if (!payment.cardCvv?.trim()) newErrors.cardCvv = "CVV is required";
      else if (!/^\d{3,4}$/.test(payment.cardCvv)) newErrors.cardCvv = "Invalid CVV";
    } else if (payment.method === "netbanking") {
      if (!payment.bank) newErrors.bank = "Please select a bank";
    } else if (payment.method === "wallet") {
      if (!payment.wallet) newErrors.wallet = "Please select a wallet";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (validateShipping()) setStep(2);
    } else if (step === 2) {
      if (validatePayment()) setStep(3);
    }
  };

  // 📱 MERCHANT NOTIFICATION SYSTEM
  const sendMerchantNotification = async (order: OrderDetails) => {
    const savedSettings = JSON.parse(localStorage.getItem("admin_settings") || "{}");
    // Respect the merchant's "auto notify" toggle — no popups/emails when it's off
    if (savedSettings.autoNotifyMerchant === false) return;
    const merchantWhatsApp = savedSettings.whatsappNumber || "";
    const merchantEmail = savedSettings.merchantEmail || "";
    const notificationMethod = savedSettings.notificationMethod || "whatsapp_link";
    const callmebotApiKey = savedSettings.callmebotApiKey || "";
    // Nothing to do if notifications are switched off entirely
    if (notificationMethod === "none") return;

    // Build order message
    const itemsList = order.items.map((item) => `• ${item.name} x${item.quantity} = ₹${item.price * item.quantity}`).join("\n");
    const message = `🎨 *NEW ORDER RECEIVED!* 🎨

📋 *Order ID:* ${order.orderId}
👤 *Customer:* ${order.shipping.fullName}
📞 *Phone:* ${order.shipping.phone}
📧 *Email:* ${order.shipping.email}

📦 *Items:*
${itemsList}

💰 *Total:* ₹${order.total}
💳 *Payment:* ${order.payment.method.toUpperCase()}

📍 *Address:*
${order.shipping.address}
${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}

⏰ *Time:* ${order.date}

---
_ResinCraft - Handmade Resin Art_`;

    // Method 1: WhatsApp Link (opens WhatsApp Web/App automatically)
    if (notificationMethod === "whatsapp_link" && merchantWhatsApp) {
      const cleanNumber = merchantWhatsApp.replace(/\D/g, "");
      const encodedMessage = encodeURIComponent(message);
      const whatsappURL = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappURL, "_blank");
    }

    // Method 2: Email notification (using mailto)
    if (notificationMethod === "email" || notificationMethod === "both") {
      const subject = encodeURIComponent(`New Order: ${order.orderId} - ₹${order.total}`);
      const emailBody = encodeURIComponent(message.replace(/\*/g, ""));
      window.open(`mailto:${merchantEmail}?subject=${subject}&body=${emailBody}`, "_blank");
    }

    // Method 3: CallMeBot - 100% Automatic WhatsApp (FREE!)
    if (notificationMethod === "callmebot_auto" && merchantWhatsApp && callmebotApiKey) {
      try {
        const cleanNumber = merchantWhatsApp.replace(/\D/g, "");
        const encodedMessage = encodeURIComponent(message);
        const callmebotURL = `https://api.callmebot.com/whatsapp.php?phone=${cleanNumber}&text=${encodedMessage}&apikey=${callmebotApiKey}`;
        
        // Send message via CallMeBot API
        const response = await fetch(callmebotURL, {
          method: "GET",
          mode: "no-cors", // Required for CallMeBot API
        });
        
        console.log("✅ CallMeBot notification sent successfully!");
        
        // Show success toast
        addToast("📱 Order notification sent to your WhatsApp!", "success");
      } catch (error) {
        console.error("❌ CallMeBot notification failed:", error);
        addToast("Failed to send WhatsApp notification", "error");
      }
    }

    // Method 4: Auto-send via third-party API (requires backend)
    if (notificationMethod === "api_auto") {
      try {
        // This would call your backend API which sends via WhatsApp Business API
        // For now, we'll use a webhook service like Pipedream/Make.com
        const webhookURL = savedSettings.webhookURL || "";
        if (webhookURL) {
          await fetch(webhookURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.orderId,
              customer: order.shipping.fullName,
              phone: order.shipping.phone,
              email: order.shipping.email,
              total: order.total,
              items: order.items,
              address: order.shipping.address,
              message: message,
            }),
          });
        }
      } catch (error) {
        console.error("Webhook notification failed:", error);
      }
    }

    // NOTE: The order record itself is created by createPlacedOrder() only after the
    // payment is completed successfully — notifications fire once payment succeeds.
  };

  // 📧 AUTO EMAIL TO CUSTOMER WITH INVOICE
  const sendCustomerEmail = async (order: OrderDetails) => {
    const savedSettings = JSON.parse(localStorage.getItem("admin_settings") || "{}");
    
    // Check if auto email is enabled and EmailJS is configured
    if (!savedSettings.autoEmailCustomer) {
      console.log("Auto email to customer is disabled");
      return;
    }

    const { emailjsServiceId, emailjsTemplateId, emailjsPublicKey } = savedSettings;
    
    if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey) {
      console.warn("EmailJS not configured. Please set up EmailJS in admin settings.");
      addToast("⚠️ Email not sent: EmailJS not configured", "error");
      return;
    }

    try {
      // Generate HTML and text versions of the email
      const htmlContent = generateOrderEmailHTML(order);
      const textContent = generateOrderEmailText(order);

      // Prepare email parameters
      const templateParams = {
        to_email: order.shipping.email,
        to_name: order.shipping.fullName,
        from_name: "ResinCraft",
        reply_to: savedSettings.merchantEmail || "support@resincraft.in",
        subject: `Order Confirmation #${order.orderId} - ResinCraft`,
        message: textContent,
        html_message: htmlContent,
        order_id: order.orderId,
        order_total: `₹${order.total.toLocaleString('en-IN')}`,
        order_date: new Date(order.date).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
      };

      // Send email via EmailJS
      await emailjs.send(
        emailjsServiceId,
        emailjsTemplateId,
        templateParams,
        emailjsPublicKey
      );

      console.log("✅ Customer email sent successfully!");
      addToast("📧 Invoice email sent to customer!", "success");
    } catch (error) {
      console.error("❌ Failed to send customer email:", error);
      addToast("Failed to send invoice email", "error");
    }
  };

  // ✅ Single source of truth: called ONLY after a payment is completed successfully.
  // The order is then placed automatically — saved to the admin orders list, the merchant
  // is notified and the customer receives the invoice email (just like other e-commerce sites).
  const finalizePaidOrder = async (order: OrderDetails) => {
    const paidOrder: OrderDetails = { ...order, paymentStatus: "paid" };

    await createPlacedOrder(paidOrder);           // 🔒 order recorded only now, after payment
    localStorage.removeItem(PENDING_UPI_ORDER_KEY);

    setOrderDetails(paidOrder);
    setIsProcessing(false);
    setStep(4);                                   // auto "Order Confirmed" screen
    addToast("Payment successful! Your order has been placed.", "success");

    // 📱 Notify merchant + 📧 send invoice email automatically
    await sendMerchantNotification(paidOrder);
    await sendCustomerEmail(paidOrder);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      addToast("Your cart is empty!", "error");
      setIsProcessing(false);
      return;
    }
    setIsProcessing(true);

    // Check if Razorpay is configured
    const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

    // If Razorpay key is configured, use real payment gateway
    if (razorpayKeyId && razorpayKeyId !== "rzp_test_XXXXXXXXXXXXXX" && typeof window !== "undefined" && (window as any).Razorpay) {
      try {
        const options = {
          key: razorpayKeyId,
          amount: total * 100, // Amount in paise
          currency: "INR",
          name: "ResinCraft",
          description: "Handmade Resin Art Order",
          image: "https://via.placeholder.com/100x100/6366f1/ffffff?text=RC",
          method: payment.method === "upi" ? "upi" : undefined,
          handler: function (response: any) {
            // 💳 Payment verified by Razorpay → place the order automatically
            const order: OrderDetails = {
              orderId: response.razorpay_payment_id || generateOrderId(),
              items: [...cart],
              shipping,
              payment,
              subtotal,
              shippingCost,
              tax,
              total,
              date: new Date().toLocaleString("en-IN"),
              paymentStatus: "pending",
            };
            finalizePaidOrder(order);
          },
          prefill: {
            name: shipping.fullName,
            email: shipping.email,
            contact: shipping.phone,
          },
          theme: {
            color: "#6366f1",
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
              addToast("Payment cancelled — your order was NOT placed. You can pay again anytime.", "info");
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      } catch (error) {
        console.error("Razorpay error:", error);
        addToast("Payment gateway error. Please try again.", "error");
        setIsProcessing(false);
        return;
      }
    }

    // Draft order — NOT placed yet, because payment must succeed first
    const order: OrderDetails = {
      orderId: generateOrderId(),
      items: [...cart],
      shipping,
      payment,
      subtotal,
      shippingCost,
      tax,
      total,
      date: new Date().toLocaleString("en-IN"),
      paymentStatus: "pending",
    };

    // UPI App mode: hand off to the payment app, then confirm on return.
    // The order gets placed automatically once the customer confirms payment is done.
    if (payment.method === "upi" && payment.upiMode === "app" && payment.upiApp) {
      const app = UPI_APPS.find((a) => a.id === payment.upiApp);
      localStorage.setItem(PENDING_UPI_ORDER_KEY, JSON.stringify(order));
      setOrderDetails(order);
      setIsProcessing(false);
      setStep(5); // "Awaiting payment confirmation" screen
      openUpiLink(buildUpiDeepLink(total, app?.link));
      addToast(`Opening ${app?.name || "your UPI app"} to complete your payment…`, "info");
      return;
    }

    // Other methods without a live gateway: simulate the payment processing step,
    // then place the order automatically when that payment succeeds (Demo Mode).
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await finalizePaidOrder(order);
  };

  // Customer confirms the payment made in the UPI app succeeded → order placed automatically
  const handleConfirmPaymentSuccess = async () => {
    setIsProcessing(true);
    const stored = localStorage.getItem(PENDING_UPI_ORDER_KEY);
    const order = orderDetails ?? (stored ? (JSON.parse(stored) as OrderDetails) : null);
    if (!order) {
      setIsProcessing(false);
      addToast("No pending payment found. Please retry checkout.", "error");
      setStep(3);
      return;
    }
    await finalizePaidOrder(order);
  };

  // Payment failed / not completed → order is NOT placed, cart stays intact
  const handleReportPaymentFailure = () => {
    localStorage.removeItem(PENDING_UPI_ORDER_KEY);
    setIsProcessing(false);
    setStep(3);
    addToast("Payment not completed — your order has NOT been placed. Please try again.", "error");
  };

  // Resume an interrupted UPI payment after the app redirects back / page reloads
  useEffect(() => {
    if (!isCheckoutOpen) {
      const stored = localStorage.getItem(PENDING_UPI_ORDER_KEY);
      if (stored && cart.length > 0) {
        try {
          const order = JSON.parse(stored) as OrderDetails;
          setOrderDetails(order);
          setStep(5);
          setIsCheckoutOpen(true);
        } catch {
          localStorage.removeItem(PENDING_UPI_ORDER_KEY);
        }
      }
    }
  }, [isCheckoutOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setIsCheckoutOpen(false);
    setStep(1);
    setShipping({ fullName: "", email: "", phone: "", address: "", city: "", state: "", pincode: "", country: "India" });
    setPayment({ method: "upi", upiMode: "app" });
    setErrors({});
    // Cart is cleared only when the order was actually placed (i.e. payment succeeded)
    if (orderDetails?.paymentStatus === "paid") clearCart();
    setOrderDetails(null);
  };

  if (!isCheckoutOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md text-white z-[80] flex items-center justify-center p-4 overflow-y-auto">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0f0f23] border border-indigo-500/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
          {/* Header */}
          <div className="sticky top-0 bg-[#0f0f23] border-b border-white/5 p-6 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold">
                {step === 4 ? "Order Confirmed" : step === 5 ? "Complete Your Payment" : "Checkout"}
              </h2>
              {step < 4 && (
                <div className="flex items-center gap-2 mt-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        s <= step ? "bg-indigo-500 text-white" : "bg-white/10 text-gray-400"
                      }`}>
                        {s < step || step === 4 ? <i className="fas fa-check"></i> : s}
                      </div>
                      {s < 3 && <div className={`w-12 h-0.5 ${s < step ? "bg-indigo-500" : "bg-white/10"}`}></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <i className="fas fa-times text-gray-400"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <h3 className="text-xl font-semibold mb-4">Shipping Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={shipping.fullName}
                      onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.fullName ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                      placeholder="John Doe"
                    />
                    {errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={shipping.email}
                      onChange={(e) => setShipping({ ...shipping, email: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.email ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                      placeholder="john@example.com"
                    />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      value={shipping.phone}
                      onChange={(e) => setShipping({ ...shipping, phone: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.phone ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                      placeholder="9876543210"
                    />
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-300 mb-2">Address *</label>
                    <textarea
                      value={shipping.address}
                      onChange={(e) => setShipping({ ...shipping, address: e.target.value })}
                      rows={3}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.address ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors resize-none`}
                      placeholder="House no, Street, Landmark"
                    />
                    {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">City *</label>
                    <input
                      type="text"
                      value={shipping.city}
                      onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.city ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                      placeholder="Mumbai"
                    />
                    {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">State *</label>
                    <input
                      type="text"
                      value={shipping.state}
                      onChange={(e) => setShipping({ ...shipping, state: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.state ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                      placeholder="Maharashtra"
                    />
                    {errors.state && <p className="text-red-400 text-xs mt-1">{errors.state}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Pincode *</label>
                    <input
                      type="text"
                      value={shipping.pincode}
                      onChange={(e) => setShipping({ ...shipping, pincode: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.pincode ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                      placeholder="400001"
                    />
                    {errors.pincode && <p className="text-red-400 text-xs mt-1">{errors.pincode}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Country</label>
                    <input
                      type="text"
                      value={shipping.country}
                      disabled
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <button onClick={handleNextStep} className="btn-primary w-full py-3.5 rounded-full text-white font-medium mt-6">
                  Continue to Payment
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <h3 className="text-xl font-semibold mb-4">Payment Method</h3>
                
                {/* Payment Security Badge */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <i className="fas fa-shield-alt text-green-400"></i>
                  <span className="text-xs text-green-300">100% Secure Payments • 256-bit SSL Encrypted • PCI-DSS Compliant</span>
                </div>

                {/* Payment Logos */}
                <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-white/5">
                  <span className="text-xs text-gray-300 mr-2">We accept:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 rounded bg-white/10 text-xs font-bold text-white">UPI</span>
                    <span className="px-2 py-1 rounded bg-blue-600/20 text-xs font-bold text-blue-300">VISA</span>
                    <span className="px-2 py-1 rounded bg-red-600/20 text-xs font-bold text-red-300">RuPay</span>
                    <span className="px-2 py-1 rounded bg-yellow-600/20 text-xs font-bold text-yellow-300">Mastercard</span>
                    <span className="px-2 py-1 rounded bg-purple-600/20 text-xs font-bold text-purple-300">Paytm</span>
                    <span className="px-2 py-1 rounded bg-indigo-600/20 text-xs font-bold text-indigo-300">PhonePe</span>
                    <span className="px-2 py-1 rounded bg-orange-600/20 text-xs font-bold text-orange-300">Amazon Pay</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* UPI */}
                  <div className={`glass-card rounded-xl p-4 cursor-pointer transition-all ${payment.method === "upi" ? "border-indigo-500/50" : ""}`} onClick={() => setPayment({ ...payment, method: "upi" })}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={payment.method === "upi"} onChange={() => setPayment({ ...payment, method: "upi" })} className="w-4 h-4 accent-indigo-500" />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2 text-white">
                          <i className="fas fa-mobile-alt text-indigo-400"></i>
                          UPI
                          <span className="ml-2 px-2 py-0.5 rounded bg-green-500/20 text-[10px] text-green-300 font-medium">RECOMMENDED</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Pay directly from any UPI app, or enter a UPI ID manually</p>
                      </div>
                      <div className="flex gap-1">
                        <span className="w-8 h-5 rounded bg-white/10 flex items-center justify-center text-[8px] font-bold text-white">GPay</span>
                        <span className="w-8 h-5 rounded bg-purple-500/20 flex items-center justify-center text-[8px] font-bold text-purple-300">PPe</span>
                        <span className="w-8 h-5 rounded bg-blue-500/20 flex items-center justify-center text-[8px] font-bold text-blue-300">Paytm</span>
                      </div>
                    </div>
                    {payment.method === "upi" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* Toggle: Pay via app vs manual UPI ID */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPayment({ ...payment, upiMode: "app" })}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${payment.upiMode === "app" ? "bg-indigo-500/20 border-indigo-500/60 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:text-white"}`}
                          >
                            <i className="fas fa-mobile-alt mr-2 text-indigo-300"></i>Open &amp; Pay via UPI App
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayment({ ...payment, upiMode: "manual" })}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${payment.upiMode === "manual" ? "bg-indigo-500/20 border-indigo-500/60 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:text-white"}`}
                          >
                            <i className="fas fa-keyboard mr-2 text-indigo-300"></i>Pay Manually via UPI ID
                          </button>
                        </div>

                        {payment.upiMode === "app" ? (
                          <div>
                            <p className="text-xs text-gray-300 mb-2">Choose your UPI app — it will open directly to complete the payment of <span className="text-white font-semibold">{formatINR(total)}</span>:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {UPI_APPS.map((app) => (
                                <button
                                  key={app.id}
                                  type="button"
                                  onClick={() => setPayment({ ...payment, upiApp: app.id })}
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${payment.upiApp === app.id ? "bg-indigo-500/20 border-indigo-500/60 ring-1 ring-indigo-400/50" : "bg-white/5 border-white/10 hover:border-white/30"}`}
                                >
                                  <span className={`w-8 h-8 rounded-lg ${app.bg} flex items-center justify-center`}>
                                    <i className={`${app.icon} ${app.color}`}></i>
                                  </span>
                                  <span className="text-xs font-medium text-white leading-tight">{app.name}</span>
                                  {payment.upiApp === app.id && <i className="fas fa-check-circle text-indigo-300 ml-auto text-sm"></i>}
                                </button>
                              ))}
                            </div>
                            {errors.upiApp && <p className="text-red-400 text-xs mt-2">{errors.upiApp}</p>}
                            <p className="text-[11px] text-gray-300 mt-2">
                              <i className="fas fa-info-circle text-indigo-300 mr-1"></i>
                              On mobile, the selected app opens automatically. On desktop, a UPI QR code / deep link is shown in your UPI app.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs text-gray-300 mb-2">Payer's UPI ID — use this if you're paying from a different UPI ID / handle:</label>
                            <input
                              type="text"
                              value={payment.upiId || ""}
                              onChange={(e) => setPayment({ ...payment, upiId: e.target.value })}
                              className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.upiId ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                              placeholder="yourname@upi"
                            />
                            {errors.upiId && <p className="text-red-400 text-xs mt-1">{errors.upiId}</p>}
                            <p className="text-[11px] text-gray-300 mt-2">
                              <i className="fas fa-info-circle text-indigo-300 mr-1"></i>
                              A collect request will be sent to this UPI ID for {formatINR(total)}. Approve it in your UPI app to complete payment.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Card */}
                  <div className={`glass-card rounded-xl p-4 cursor-pointer transition-all ${payment.method === "card" ? "border-indigo-500/50" : ""}`} onClick={() => setPayment({ ...payment, method: "card" })}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={payment.method === "card"} onChange={() => setPayment({ ...payment, method: "card" })} className="w-4 h-4 accent-indigo-500" />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <i className="fas fa-credit-card text-indigo-400"></i>
                          Credit / Debit Card
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Visa, Mastercard, RuPay, American Express</p>
                      </div>
                      <div className="flex gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-blue-600/20 text-[8px] font-bold text-blue-300">VISA</span>
                        <span className="px-1.5 py-0.5 rounded bg-yellow-600/20 text-[8px] font-bold text-yellow-300">MC</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-600/20 text-[8px] font-bold text-red-300">RuPay</span>
                      </div>
                    </div>
                    {payment.method === "card" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-3">
                        <input
                          type="text"
                          value={payment.cardNumber || ""}
                          onChange={(e) => setPayment({ ...payment, cardNumber: e.target.value })}
                          className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.cardNumber ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                          placeholder="1234 5678 9012 3456"
                        />
                        {errors.cardNumber && <p className="text-red-400 text-xs mt-1">{errors.cardNumber}</p>}
                        <input
                          type="text"
                          value={payment.cardName || ""}
                          onChange={(e) => setPayment({ ...payment, cardName: e.target.value })}
                          className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.cardName ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                          placeholder="Cardholder Name"
                        />
                        {errors.cardName && <p className="text-red-400 text-xs mt-1">{errors.cardName}</p>}
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={payment.cardExpiry || ""}
                            onChange={(e) => setPayment({ ...payment, cardExpiry: e.target.value })}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.cardExpiry ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                            placeholder="MM/YY"
                          />
                          <input
                            type="text"
                            value={payment.cardCvv || ""}
                            onChange={(e) => setPayment({ ...payment, cardCvv: e.target.value })}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.cardCvv ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                            placeholder="CVV"
                          />
                        </div>
                        {errors.cardExpiry && <p className="text-red-400 text-xs mt-1">{errors.cardExpiry}</p>}
                        {errors.cardCvv && <p className="text-red-400 text-xs mt-1">{errors.cardCvv}</p>}
                      </motion.div>
                    )}
                  </div>

                  {/* Net Banking */}
                  <div className={`glass-card rounded-xl p-4 cursor-pointer transition-all ${payment.method === "netbanking" ? "border-indigo-500/50" : ""}`} onClick={() => setPayment({ ...payment, method: "netbanking" })}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={payment.method === "netbanking"} onChange={() => setPayment({ ...payment, method: "netbanking" })} className="w-4 h-4 accent-indigo-500" />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <i className="fas fa-university text-indigo-400"></i>
                          Net Banking
                          <span className="ml-2 px-2 py-0.5 rounded bg-blue-500/20 text-[10px] text-blue-300 font-medium">47+ BANKS</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">All major Indian banks supported</p>
                      </div>
                      <div className="flex gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[8px] font-bold text-blue-300">SBI</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[8px] font-bold text-red-300">HDFC</span>
                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-[8px] font-bold text-yellow-300">ICICI</span>
                      </div>
                    </div>
                    {payment.method === "netbanking" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4">
                        <select
                          value={payment.bank || ""}
                          onChange={(e) => setPayment({ ...payment, bank: e.target.value })}
                          className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.bank ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                        >
                          <option value="" className="bg-[#0f0f23]">Select Bank</option>
                          <option value="sbi" className="bg-[#0f0f23]">State Bank of India</option>
                          <option value="hdfc" className="bg-[#0f0f23]">HDFC Bank</option>
                          <option value="icici" className="bg-[#0f0f23]">ICICI Bank</option>
                          <option value="axis" className="bg-[#0f0f23]">Axis Bank</option>
                          <option value="kotak" className="bg-[#0f0f23]">Kotak Mahindra Bank</option>
                          <option value="pnb" className="bg-[#0f0f23]">Punjab National Bank</option>
                          <option value="bob" className="bg-[#0f0f23]">Bank of Baroda</option>
                          <option value="other" className="bg-[#0f0f23]">Other Banks</option>
                        </select>
                        {errors.bank && <p className="text-red-400 text-xs mt-1">{errors.bank}</p>}
                      </motion.div>
                    )}
                  </div>

                  {/* Wallet */}
                  <div className={`glass-card rounded-xl p-4 cursor-pointer transition-all ${payment.method === "wallet" ? "border-indigo-500/50" : ""}`} onClick={() => setPayment({ ...payment, method: "wallet" })}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={payment.method === "wallet"} onChange={() => setPayment({ ...payment, method: "wallet" })} className="w-4 h-4 accent-indigo-500" />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <i className="fas fa-wallet text-indigo-400"></i>
                          Wallet
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Paytm, PhonePe, Amazon Pay, Mobikwik</p>
                      </div>
                      <div className="flex gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[8px] font-bold text-blue-300">Paytm</span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-[8px] font-bold text-purple-300">PPe</span>
                        <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-[8px] font-bold text-orange-300">Amazon</span>
                      </div>
                    </div>
                    {payment.method === "wallet" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4">
                        <select
                          value={payment.wallet || ""}
                          onChange={(e) => setPayment({ ...payment, wallet: e.target.value })}
                          className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${errors.wallet ? "border-red-500" : "border-white/10"} text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors`}
                        >
                          <option value="" className="bg-[#0f0f23]">Select Wallet</option>
                          <option value="paytm" className="bg-[#0f0f23]">Paytm Wallet</option>
                          <option value="phonepe" className="bg-[#0f0f23]">PhonePe Wallet</option>
                          <option value="amazon" className="bg-[#0f0f23]">Amazon Pay</option>
                          <option value="mobikwik" className="bg-[#0f0f23]">Mobikwik</option>
                          <option value="freecharge" className="bg-[#0f0f23]">Freecharge</option>
                        </select>
                        {errors.wallet && <p className="text-red-400 text-xs mt-1">{errors.wallet}</p>}
                      </motion.div>
                    )}
                  </div>


                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3.5 rounded-full text-white font-medium">
                    Back
                  </button>
                  <button onClick={handleNextStep} className="btn-primary flex-1 py-3.5 rounded-full text-white font-medium">
                    Review Order
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <h3 className="text-xl font-semibold mb-4">Order Summary</h3>
                
                {/* Items */}
                <div className="glass-card rounded-xl p-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <p className="text-xs text-gray-300">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-indigo-300 font-semibold">{formatINR(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                {/* Shipping Address */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <i className="fas fa-map-marker-alt text-indigo-400"></i>
                    Shipping Address
                  </h4>
                  <p className="text-sm text-gray-400">
                    {shipping.fullName}<br />
                    {shipping.address}<br />
                    {shipping.city}, {shipping.state} - {shipping.pincode}<br />
                    {shipping.country}<br />
                    <span className="text-gray-300">📞 {shipping.phone} • ✉️ {shipping.email}</span>
                  </p>
                </div>

                {/* Payment Method */}
                <div className="glass-card rounded-xl p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <i className="fas fa-credit-card text-indigo-400"></i>
                    Payment Method
                  </h4>
                  <p className="text-sm text-gray-300">
                    {payment.method === "upi" && payment.upiMode === "app" && `UPI App: ${UPI_APPS.find((a) => a.id === payment.upiApp)?.name || "—"} (opens directly to pay)`}
                    {payment.method === "upi" && payment.upiMode === "manual" && `UPI (Manual): ${payment.upiId}`}
                    {payment.method === "card" && `Card ending in ${payment.cardNumber?.slice(-4)}`}
                    {payment.method === "netbanking" && `Net Banking: ${payment.bank?.toUpperCase()}`}
                    {payment.method === "wallet" && `Wallet: ${payment.wallet?.toUpperCase()}`}
                  </p>
                  {payment.method === "upi" && payment.upiMode === "app" && payment.upiApp && (
                    <button
                      type="button"
                      onClick={() => {
                        const app = UPI_APPS.find((a) => a.id === payment.upiApp);
                        openUpiLink(buildUpiDeepLink(total, app?.link));
                        addToast(`Opening ${app?.name || "your UPI app"} to complete your payment…`, "info");
                      }}
                      className="mt-3 w-full py-3 rounded-xl bg-indigo-500/20 border border-indigo-500/50 text-white font-medium hover:bg-indigo-500/30 transition-colors"
                    >
                      <i className={`fas fa-mobile-alt mr-2 text-indigo-300`}></i>
                      Open {UPI_APPS.find((a) => a.id === payment.upiApp)?.name} &amp; Pay {formatINR(total)}
                    </button>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="glass-card rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span>{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Shipping</span>
                    <span>{shippingCost === 0 ? <span className="text-green-400">FREE</span> : formatINR(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">GST (18%)</span>
                    <span>{formatINR(tax)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-gradient">{formatINR(total)}</span>
                  </div>
                </div>

                {/* Demo Mode Notice */}
                {(!import.meta.env.VITE_RAZORPAY_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID === "rzp_test_XXXXXXXXXXXXXX") && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                    <i className="fas fa-info-circle text-yellow-400"></i>
                    <span className="text-xs text-yellow-300">Demo Mode — Configure Razorpay keys in .env (VITE_RAZORPAY_KEY_ID) or set your Merchant UPI ID in Admin → Settings for real payments.</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-secondary flex-1 py-3.5 rounded-full text-white font-medium">
                    Back
                  </button>
                  <button onClick={handlePlaceOrder} disabled={isProcessing} className="btn-primary flex-1 py-3.5 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="fas fa-spinner fa-spin"></i>
                        Processing Payment...
                      </span>
                    ) : (
                      `Pay & Place Order • ${formatINR(total)}`
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5 — Payment in progress: order is placed automatically once payment succeeds */}
            {step === 5 && orderDetails && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-mobile-alt text-4xl text-indigo-300"></i>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Complete your payment of {formatINR(orderDetails.total)}</h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    Your UPI app should have opened with the collect request. Finish the payment there —{" "}
                    <span className="text-white font-medium">your order will be placed automatically</span> as soon as the
                    payment is done. No need to place it again.
                  </p>
                </div>

                <div className="glass-card rounded-xl p-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Order ID</span>
                    <span className="font-mono text-indigo-300">{orderDetails.orderId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Amount to pay</span>
                    <span className="font-bold text-white">{formatINR(orderDetails.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Status</span>
                    <span className="text-yellow-300"><i className="fas fa-clock mr-1"></i>Awaiting payment…</span>
                  </div>
                </div>

                {/* Desktop / app-didn't-open fallback: scan-to-pay QR */}
                <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src={upiQrUrl(buildUpiDeepLink(orderDetails.total))}
                    alt="UPI payment QR code"
                    className="w-[180px] h-[180px] rounded-lg bg-white p-2 shrink-0"
                  />
                  <div className="text-left">
                    <h4 className="font-medium mb-1">App didn't open? Scan to pay instead</h4>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Open any UPI app (Google Pay, PhonePe, Paytm, BHIM…) → <span className="text-white">Scan &amp; Pay</span> →
                      scan this QR. It contains the exact amount ({formatINR(orderDetails.total)}) so you can't mistype it.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const link = buildUpiDeepLink(orderDetails.total);
                        if (!openUpiLink(link)) window.location.href = link; // last-resort same-tab navigation
                      }}
                      className="mt-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 hover:bg-white/10 transition-colors"
                    >
                      <i className="fas fa-sync-alt mr-1.5 text-indigo-300"></i>
                      Copy-safe: retry opening the UPI link
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-start gap-2">
                  <i className="fas fa-lock text-green-400 mt-0.5"></i>
                  <span className="text-xs text-gray-300">
                    Your order is only confirmed and charged once. If the payment fails or you cancel, nothing is ordered and your cart stays intact.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      const app = UPI_APPS.find((a) => a.id === orderDetails.payment.upiApp);
                      const link = buildUpiDeepLink(orderDetails.total, app?.link);
                      if (!openUpiLink(link)) window.location.href = link; // last-resort same-tab navigation
                    }}
                    className="btn-secondary flex-1 py-3.5 rounded-full text-white font-medium"
                  >
                    <i className="fas fa-redo mr-2"></i>
                    Open {UPI_APPS.find((a) => a.id === orderDetails.payment.upiApp)?.name || "UPI App"} Again
                  </button>
                  <button
                    onClick={handleReportPaymentFailure}
                    className="px-6 py-3.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 font-medium hover:bg-red-500/20 transition-colors"
                  >
                    Payment Failed / Cancelled
                  </button>
                  <button
                    onClick={handleConfirmPaymentSuccess}
                    disabled={isProcessing}
                    className="btn-primary flex-1 py-3.5 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="fas fa-spinner fa-spin"></i>
                        Placing your order…
                      </span>
                    ) : (
                      <span>
                        <i className="fas fa-check-circle mr-2"></i>
                        I Have Paid — Place My Order
                      </span>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && orderDetails && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <i className="fas fa-check text-4xl text-green-400"></i>
                </div>
                
                <div>
                  <h3 className="text-2xl font-bold mb-2">Order Placed Successfully!</h3>
                  <p className="text-green-300 mb-1"><i className="fas fa-check-circle mr-1"></i>Payment received — your order was confirmed automatically.</p>
                  <p className="text-gray-400">Thank you for your purchase</p>
                </div>

                <div className="glass-card rounded-xl p-6 text-left space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-gray-400">Order ID</span>
                    <span className="font-mono font-bold text-indigo-300">{orderDetails.orderId}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-gray-400">Date</span>
                    <span>{orderDetails.date}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-gray-400">Payment Status</span>
                    <span className={orderDetails.paymentStatus === "paid" ? "text-green-400 font-medium" : "text-yellow-300 font-medium"}>
                      <i className={`fas ${orderDetails.paymentStatus === "paid" ? "fa-lock-open" : "fa-clock"} mr-1`}></i>
                      {orderDetails.paymentStatus === "paid" ? "PAID • Successful" : "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-gray-300">Payment</span>
                    <span className="capitalize">
                      {orderDetails.payment.method === "upi" && orderDetails.payment.upiMode === "app"
                        ? `UPI • ${UPI_APPS.find((a) => a.id === orderDetails.payment.upiApp)?.name || "App"}`
                        : orderDetails.payment.method === "upi"
                        ? `UPI • ${orderDetails.payment.upiId}`
                        : orderDetails.payment.method}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Amount</span>
                    <span className="text-xl font-bold text-gradient">{formatINR(orderDetails.total)}</span>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-4 text-left">
                  <h4 className="font-medium mb-2">Shipping to:</h4>
                  <p className="text-sm text-gray-400">
                    {orderDetails.shipping.fullName}<br />
                    {orderDetails.shipping.address}<br />
                    {orderDetails.shipping.city}, {orderDetails.shipping.state} - {orderDetails.shipping.pincode}
                  </p>
                </div>

                <p className="text-sm text-gray-300">
                  A confirmation email has been sent to {orderDetails.shipping.email}
                </p>

                <button onClick={handleClose} className="btn-primary px-8 py-3 rounded-full text-white font-medium">
                  Continue Shopping
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== HERO SECTION ====================
function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden hero-gradient">
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <img src={IMAGES.hero} alt="Resin Art" className="w-full h-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f23]/70 via-[#0f0f23]/40 to-[#0f0f23]"></div>
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }} className="mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full border border-indigo-500/30 text-xs uppercase tracking-widest text-indigo-300/80">
            ✦ Handmade Resin Art ✦
          </span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.5 }} className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight mb-6">
          Liquid Art,<br /><span className="text-gradient">Solid Beauty</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.7 }} className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Discover stunning handmade epoxy resin art — from ocean waves to galaxy pours, each piece is a unique masterpiece crafted with love and creativity.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.9 }} className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => { const el = document.getElementById("collection"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="btn-primary px-8 py-4 rounded-full text-white font-medium text-base">
            Explore Collection
          </button>
          <button onClick={() => { const el = document.getElementById("about"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="btn-secondary px-8 py-4 rounded-full text-indigo-200 font-medium text-base">
            Our Story
          </button>
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-6 h-10 rounded-full border-2 border-indigo-500/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-indigo-400/60 rounded-full"></div>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ==================== MARQUEE ====================
function MarqueeSection() {
  return (
    <div className="py-8 border-y border-indigo-500/10 overflow-hidden bg-[#0f0f23]/80">
      <div className="marquee whitespace-nowrap flex items-center gap-12">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center gap-12">
            {["EPOXY RESIN", "OCEAN ART", "FLOWER PRESERVES", "GEODE ART", "GALAXY POURS", "COASTERS", "TRAYS", "JEWELRY", "WALL ART", "CUSTOM ORDERS"].map((text, j) => (
              <span key={j} className="text-sm uppercase tracking-[0.3em] text-indigo-500/40 flex items-center gap-12">
                {text}
                <span className="w-2 h-2 rounded-full bg-indigo-500/20"></span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== PRODUCT CARD ====================
function ProductCard({ product }: { product: typeof products[0] }) {
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart } = useCart();
  const { addToast } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product);
    addToast(`${product.name} added to cart!`, "success");
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToast(`${product.name} — ${product.description}`, "info");
  };

  return (
    <div className="card-hover glass-card rounded-2xl overflow-hidden group cursor-pointer" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className="relative aspect-[4/5] overflow-hidden glossy-effect">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-md text-xs font-medium text-indigo-200 border border-indigo-500/30">
            {product.tag}
          </span>
        </div>

        <button onClick={(e) => { e.stopPropagation(); addToast("Added to wishlist ❤️", "success"); }} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-pink-400 hover:border-pink-400/30 transition-all">
          <i className="far fa-heart text-sm"></i>
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }} transition={{ duration: 0.3 }} className="absolute bottom-4 left-4 right-4 flex gap-2">
          <button onClick={handleAddToCart} className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-medium text-white">
            Add to Cart
          </button>
          <button onClick={handleQuickView} className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <i className="fas fa-eye text-sm"></i>
          </button>
        </motion.div>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-semibold mb-1">{product.name}</h3>
        <p className="text-sm text-gray-400 mb-2">{product.medium} • {product.size}</p>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-gradient">{formatINR(product.price)}</span>
        </div>
      </div>
    </div>
  );
}

// ==================== FEATURED SECTION ====================
function FeaturedSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="featured" ref={ref} className="py-32 section-gradient">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="text-center mb-20">
          <motion.p variants={fadeInUp} className="text-sm uppercase tracking-widest text-indigo-400 mb-4">Featured Works</motion.p>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Stunning <span className="text-gradient">Resin</span> Creations
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-gray-400 max-w-xl mx-auto text-lg">
            Each piece is hand-poured and unique — no two resin artworks are ever the same.
          </motion.p>
        </motion.div>

        <div className="h-0.5 bg-white/5 rounded-full mb-16 overflow-hidden">
          <motion.div style={{ width: progressWidth }} className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full"></motion.div>
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.slice(0, 3).map((product) => (
            <motion.div key={product.id} variants={fadeInScale}>
              <ProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ==================== COLLECTION SECTION ====================
function CollectionSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x1 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const x2 = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <section id="collection" ref={ref} className="py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <motion.p variants={fadeInUp} className="text-sm uppercase tracking-widest text-indigo-400 mb-4">The Collection</motion.p>
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-6xl font-bold tracking-tight">
              Every Piece,<br />A <span className="text-gradient">Universe</span>
            </motion.h2>
          </div>
          <motion.p variants={fadeInUp} className="text-gray-400 max-w-md text-base">
            Browse our complete collection of handmade resin art. Ocean waves, galaxy pours, flower preserves — each piece tells a different story.
          </motion.p>
        </motion.div>
      </div>

      <div className="space-y-6 mb-20">
        <motion.div style={{ x: x1 }} className="flex gap-6 px-6">
          {[IMAGES.product1, IMAGES.product3, IMAGES.product4, IMAGES.product1, IMAGES.product3].map((img, i) => (
            <div key={i} className="flex-shrink-0 w-72 h-96 rounded-2xl overflow-hidden group cursor-pointer">
              <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
          ))}
        </motion.div>
        <motion.div style={{ x: x2 }} className="flex gap-6 px-6">
          {[IMAGES.product2, IMAGES.product5, IMAGES.product6, IMAGES.product2, IMAGES.product5].map((img, i) => (
            <div key={i} className="flex-shrink-0 w-72 h-96 rounded-2xl overflow-hidden group cursor-pointer">
              <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
          ))}
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <motion.div key={product.id} variants={fadeInUp}>
              <ProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ==================== ABOUT SECTION ====================
function AboutSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" ref={ref} className="py-32 section-gradient">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={slideInLeft} className="relative">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/5]">
              <img src={IMAGES.product2} alt="Resin art process" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 0.5, duration: 0.6 }} className="absolute -bottom-6 -right-6 glass-card rounded-2xl p-6 pulse-glow">
              <div className="text-3xl font-bold text-gradient">300+</div>
              <div className="text-sm text-gray-400">Pieces Created</div>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={slideInRight}>
            <p className="text-sm uppercase tracking-widest text-indigo-400 mb-4">The Artist</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Pouring Hearts<br />Into <span className="text-gradient">Every Piece</span>
            </h2>
            <div className="space-y-4 text-gray-400 leading-relaxed">
              <p>
                What started as a creative hobby has blossomed into a passion for creating stunning epoxy resin art. Each piece is carefully hand-poured, layer by layer, to create unique works that capture light, color, and movement.
              </p>
              <p>
                From ocean wave art that brings the sea into your home, to galaxy pours that capture the cosmos, every creation is a one-of-a-kind masterpiece that you'll treasure forever.
              </p>
              <p>
                We use premium UV-resistant epoxy resin, high-quality pigments, and real dried flowers to ensure each piece stays vibrant and beautiful for years to come.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-10">
              {[
                { number: "5+", label: "Years Crafting" },
                { number: "200+", label: "Happy Customers" },
                { number: "100%", label: "Handmade" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold text-gradient">{stat.number}</div>
                  <div className="text-xs text-gray-300 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            <button onClick={() => { const el = document.getElementById("process"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} className="btn-primary px-6 py-3 rounded-full text-sm font-medium text-white mt-8">
              See Our Process →
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ==================== PROCESS SECTION ====================
function ProcessSection() {
  const steps = [
    { icon: "fas fa-lightbulb", title: "Design & Plan", description: "We plan colors, techniques, and composition — every pour is carefully thought out before it begins." },
    { icon: "fas fa-flask", title: "Mix & Pour", description: "Premium epoxy resin is mixed with pigments, glitter, or dried flowers, then carefully poured in layers." },
    { icon: "fas fa-fire", title: "Cure & Set", description: "Each piece cures for 24-72 hours, transforming from liquid art into a stunning solid masterpiece." },
    { icon: "fas fa-gem", title: "Finish & Polish", description: "Final sanding, buffing, and coating gives each piece its signature glossy, glass-like finish." },
  ];

  return (
    <section id="process" className="py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="text-center mb-20">
          <motion.p variants={fadeInUp} className="text-sm uppercase tracking-widest text-indigo-400 mb-4">The Process</motion.p>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            From Liquid to <span className="text-gradient">Masterpiece</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-gray-400 max-w-xl mx-auto text-lg">
            Every resin artwork goes through a meticulous multi-step process to achieve perfection.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} transition={{ delay: i * 0.15 }} className="glass-card rounded-2xl p-8 text-center group hover:border-indigo-500/30 transition-all duration-500">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                <i className={`${step.icon} text-xl text-indigo-400`}></i>
              </div>
              <div className="text-xs text-gray-300 mb-2">Step {String(i + 1).padStart(2, "0")}</div>
              <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==================== TESTIMONIALS ====================
function TestimonialsSection() {
  const testimonials = [
    { name: "Sneha P.", role: "Home Decor Enthusiast", text: "The ocean wave piece is absolutely mesmerizing! It catches the light beautifully and has become the centerpiece of my living room. So happy with my purchase!", rating: 5 },
    { name: "Arjun M.", role: "Gift Buyer", text: "Ordered the coaster set as a gift and it was a huge hit! The marble effect is stunning and the quality is incredible. Will definitely order more.", rating: 5 },
    { name: "Kavya R.", role: "Art Collector", text: "I've bought three pieces now — the galaxy pour, flower preserve, and geode art. Each one is more beautiful than the last. Truly unique handmade art.", rating: 5 },
  ];

  return (
    <section className="py-32 section-gradient">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="text-center mb-16">
          <motion.p variants={fadeInUp} className="text-sm uppercase tracking-widest text-indigo-400 mb-4">Testimonials</motion.p>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold tracking-tight">
            What Customers <span className="text-gradient">Say</span>
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} transition={{ delay: i * 0.15 }} className="glass-card rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[...Array(t.rating)].map((_, j) => (
                  <i key={j} className="fas fa-star text-indigo-400 text-sm"></i>
                ))}
              </div>
              <p className="text-gray-300 leading-relaxed mb-6 italic">"{t.text}"</p>
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-gray-300">{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==================== CTA / NEWSLETTER ====================
function CTASection() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const { addToast } = useToast();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      addToast("Please enter a valid email address", "error");
      return;
    }
    setSubscribed(true);
    addToast("Welcome! You've been added to our list 🎉", "success");
    setEmail("");
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <section id="contact" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 hero-gradient"></div>
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Want a Custom<br /><span className="text-gradient">Resin Piece?</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
            Join our list to get updates on new designs, custom order availability, and exclusive discounts on handmade resin art.
          </motion.p>
          <motion.form variants={fadeInUp} onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="flex-1 px-6 py-4 rounded-full bg-white/5 border border-indigo-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors" />
            <button type="submit" className="btn-primary px-8 py-4 rounded-full text-white font-medium whitespace-nowrap">
              {subscribed ? "✓ Subscribed!" : "Join Waitlist"}
            </button>
          </motion.form>
          <motion.p variants={fadeInUp} className="text-xs text-gray-300 mt-4">
            No spam. Unsubscribe anytime. We respect your privacy.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// AdminConfigPanel removed - all settings now accessible only via admin panel (Ctrl+Shift+A)

// ==================== FOOTER ====================
function Footer() {
  const { addToast } = useToast();

  const handleFooterLink = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    if (label === "Contact" || label === "Shipping" || label === "Returns" || label === "FAQ") {
      const el = document.getElementById("contact");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (label === "About Us" || label === "The Artist") {
      const el = document.getElementById("about");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (label === "Process") {
      const el = document.getElementById("process");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (["All Art", "Ocean Art", "Flower Art", "Geode Art", "Coasters"].includes(label)) {
      const el = document.getElementById("collection");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      addToast(`${label} page coming soon!`, "info");
    }
  };

  return (
    <footer className="border-t border-indigo-500/10 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">✦</span>
              </div>
              <span className="text-xl font-bold tracking-tight">RESIN<span className="text-gradient">CRAFT</span></span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Handmade epoxy resin art for those who appreciate unique, colorful, and stunning decor pieces.
            </p>
            <div className="flex items-center gap-4 mt-4">
              {["fab fa-instagram", "fab fa-pinterest", "fab fa-youtube", "fab fa-facebook"].map((icon, i) => (
                <button key={i} onClick={() => addToast("Follow us on social media!", "info")} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-300 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                  <i className={`${icon} text-sm`}></i>
                </button>
              ))}
            </div>
          </div>

          {[
            { title: "Shop", links: ["All Art", "Ocean Art", "Flower Art", "Geode Art", "Coasters"] },
            { title: "Company", links: ["About Us", "The Artist", "Process", "Custom Orders", "Blog"] },
            { title: "Support", links: ["Contact", "Shipping", "Returns", "FAQ", "Care Guide"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-indigo-300/80">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <button onClick={(e) => handleFooterLink(e, link)} className="text-sm text-gray-300 hover:text-indigo-300 transition-colors">
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-300">© 2026 ResinCraft. All rights reserved. Every piece is one-of-a-kind.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => addToast("Privacy Policy page coming soon!", "info")} className="text-xs text-gray-300 hover:text-white transition-colors">Privacy</button>
            <button onClick={() => addToast("Terms of Service page coming soon!", "info")} className="text-xs text-gray-300 hover:text-white transition-colors">Terms</button>
            <span className="text-xs text-gray-300">Payments via UPI, Cards & Net Banking</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ==================== SECURITY CONFIG ====================
const ADMIN_CONFIG = {
  // 🔐 CHANGE THIS PASSWORD BEFORE GOING LIVE
  // Use a strong password: mix of uppercase, lowercase, numbers, symbols
  // Example: "MyStr0ng!Pass#2024"
  password: "admin123",
  
  // Session timeout in minutes (auto-logout after inactivity)
  sessionTimeout: 30,
  
  // Max login attempts before lockout
  maxAttempts: 5,
  
  // Lockout duration in minutes
  lockoutDuration: 15,
  
  // Enable 2FA (requires email verification)
  require2FA: false,
  
  // Allowed IP addresses (empty = allow all)
  // Example: ["192.168.1.1", "10.0.0.1"]
  allowedIPs: [] as string[],
};

// ==================== ADMIN ACCESS ====================
function AdminAccess() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if account is locked
  const isLocked = () => {
    if (!lockedUntil) return false;
    if (Date.now() < lockedUntil) return true;
    setLockedUntil(null);
    setAttempts(0);
    return false;
  };

  // Reset activity timer
  const resetActivityTimer = () => {
    if (activityTimer.current) clearTimeout(activityTimer.current);
    activityTimer.current = setTimeout(() => {
      if (showAdmin) {
        setShowAdmin(false);
        alert("Session expired due to inactivity. Please login again.");
      }
    }, ADMIN_CONFIG.sessionTimeout * 60 * 1000);
  };

  // Track user activity
  useEffect(() => {
    if (showAdmin) {
      resetActivityTimer();
      const handleActivity = () => resetActivityTimer();
      window.addEventListener("mousemove", handleActivity);
      window.addEventListener("keypress", handleActivity);
      return () => {
        window.removeEventListener("mousemove", handleActivity);
        window.removeEventListener("keypress", handleActivity);
        if (activityTimer.current) clearTimeout(activityTimer.current);
      };
    }
  }, [showAdmin]);

  // Keyboard shortcut: Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        if (!isLocked()) {
          setShowLogin(true);
        } else {
          const minutes = Math.ceil((lockedUntil! - Date.now()) / 60000);
          alert(`Account locked. Try again in ${minutes} minutes.`);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lockedUntil]);

  // Logo click detection (5 clicks in 3 seconds)
  const handleLogoClick = () => {
    if (isLocked()) {
      const minutes = Math.ceil((lockedUntil! - Date.now()) / 60000);
      alert(`Account locked. Try again in ${minutes} minutes.`);
      return;
    }

    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    
    if (clickCount.current >= 5) {
      setShowLogin(true);
      clickCount.current = 0;
    } else {
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 3000);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked()) {
      const minutes = Math.ceil((lockedUntil! - Date.now()) / 60000);
      setError(`Account locked. Try again in ${minutes} minutes.`);
      return;
    }

    // Check password
    if (password === ADMIN_CONFIG.password) {
      setShowLogin(false);
      setShowAdmin(true);
      setPassword("");
      setError("");
      setAttempts(0);
      setSessionExpiry(Date.now() + ADMIN_CONFIG.sessionTimeout * 60 * 1000);
      
      // Log login attempt
      console.log(`[SECURITY] Admin login successful at ${new Date().toISOString()}`);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      // Log failed attempt
      console.warn(`[SECURITY] Failed login attempt ${newAttempts}/${ADMIN_CONFIG.maxAttempts} at ${new Date().toISOString()}`);
      
      if (newAttempts >= ADMIN_CONFIG.maxAttempts) {
        const lockUntil = Date.now() + ADMIN_CONFIG.lockoutDuration * 60 * 1000;
        setLockedUntil(lockUntil);
        setError(`Too many failed attempts. Account locked for ${ADMIN_CONFIG.lockoutDuration} minutes.`);
        console.error(`[SECURITY] Account locked until ${new Date(lockUntil).toISOString()}`);
      } else {
        const remaining = ADMIN_CONFIG.maxAttempts - newAttempts;
        setError(`Invalid password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`);
      }
    }
  };

  return (
    <>
      {/* Hidden trigger on logo */}
      <div
        onClick={handleLogoClick}
        className="fixed top-4 left-6 w-10 h-10 z-40 cursor-pointer"
        title="Admin Access"
      />

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowLogin(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0f0f23] border border-indigo-500/20 rounded-2xl p-8 w-full max-w-md"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-shield-alt text-white text-2xl"></i>
                </div>
                <h2 className="text-2xl font-bold mb-2">Admin Login</h2>
                <p className="text-sm text-gray-300">Enter password to access admin panel</p>
              </div>

              {isLocked() ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-lock text-red-400 text-xl"></i>
                  </div>
                  <p className="text-red-400 font-medium mb-2">Account Locked</p>
                  <p className="text-sm text-gray-300">
                    Too many failed attempts. Try again in{" "}
                    <span className="text-white font-semibold">
                      {Math.ceil((lockedUntil! - Date.now()) / 60000)} minutes
                    </span>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                      placeholder="Enter admin password"
                      autoFocus
                      disabled={isLocked()}
                    />
                    {error && (
                      <p className={`text-xs mt-2 ${error.includes("locked") ? "text-red-400" : "text-yellow-400"}`}>
                        <i className="fas fa-exclamation-triangle mr-1"></i>
                        {error}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isLocked()}
                    className="btn-primary w-full py-3 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Login
                  </button>
                </form>
              )}

              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-xs text-gray-300 text-center mb-2">
                  <i className="fas fa-info-circle mr-1"></i>
                  Security: {ADMIN_CONFIG.sessionTimeout}min session timeout • {ADMIN_CONFIG.maxAttempts} max attempts
                </p>
                <p className="text-xs text-gray-700 text-center">
                  Tip: Press Ctrl+Shift+A or click logo 5 times
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel */}
      <AnimatePresence>
        {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      </AnimatePresence>
    </>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  return (
    <CartProvider>
      <ToastProvider>
        <div className="relative">
          <div className="noise-overlay"></div>
          <AdminAccess />
          <Navbar />
          <CartSidebar />
          <CheckoutModal />
          <HeroSection />
          <MarqueeSection />
          <FeaturedSection />
          <CollectionSection />
          <AboutSection />
          <ProcessSection />
          <TestimonialsSection />
          <CTASection />
          <Footer />
        </div>
      </ToastProvider>
    </CartProvider>
  );
}
