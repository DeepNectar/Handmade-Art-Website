import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import emailjs from "@emailjs/browser";
import {
  NotifyOrder,
  notifySubject,
  buildShipmentEmailHTML,
  buildShipmentEmailText,
  buildDeliveredEmailHTML,
  buildDeliveredEmailText,
  buildCancelledEmailHTML,
  buildCancelledEmailText,
  whatsappTemplates,
  buildWhatsappLink,
} from "./notifications";

// ==================== TYPES ====================
interface AdminProduct {
  id: number;
  name: string;
  price: number;
  medium: string;
  size: string;
  image: string;
  tag: string;
  description: string;
  stock: number;
  active: boolean;
}

interface AdminOrder {
  orderId: string;
  customerName: string;
  email: string;
  phone: string;
  items: { name: string; price: number; quantity: number }[];
  total: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  paymentMethod: string;
  paymentStatus?: "pending" | "paid" | "failed";
  date: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  // Shipment & invoice (invoice is generated ONLY once the order is shipped)
  awb?: string;
  courier?: string;
  expectedDelivery?: string;
  shippedAt?: string;
  invoiceNumber?: string;
  invoiceGeneratedAt?: string;
  // UPI automatic verification plumbing (set by checkout when the payment handoff starts)
  upiTransactionRef?: string; // our `tr` reference embedded in the UPI link/QR
  upiBankRef?: string;        // bank RRN recorded when the payment was verified
}

interface AdminSettings {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  merchantUpiId: string; // Merchant UPI/VPA — used by the checkout "Open & Pay via UPI App" deep links & QR
  merchantName: string;
  merchantEmail: string;
  merchantPhone: string;
  shippingFreeAbove: number;
  shippingCharge: number;
  gstPercent: number;
  currency: string;
  whatsappNumber: string;
  callmebotApiKey: string;
  notificationMethod: "whatsapp_link" | "email" | "both" | "callmebot_auto" | "api_auto" | "none";
  webhookURL: string;
  autoNotifyMerchant: boolean;
  // EmailJS Configuration
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
  autoEmailCustomer: boolean;
  // Ship-out automation: when an order is marked SHIPPED, automatically generate &
  // email the tax invoice and send the WhatsApp shipping notification.
  autoInvoiceOnShipping: boolean;
  autoWhatsappOnShipping: boolean;
}

// ==================== HELPERS ====================
const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
};

// LocalStorage helpers
const getFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// ==================== DEFAULT DATA ====================
const defaultProducts: AdminProduct[] = [
  { id: 1, name: "Ocean Wave Resin Art", price: 8500, medium: "Epoxy Resin on Wood", size: '24" × 18"', image: "https://image.qwenlm.ai/generated-images/0a1804b5-c61a-4df6-8dac-e38469533723/_result.png", tag: "Bestseller", description: "Deep blue ocean wave with white foam details, glossy finish.", stock: 5, active: true },
  { id: 2, name: "Botanical Flower Preserve", price: 6500, medium: "Clear Resin with Flowers", size: '12" × 12"', image: "https://image.qwenlm.ai/generated-images/6cd469dc-fd2d-4890-a660-3a4faed1ba4f/_result.png", tag: "New", description: "Real pressed wildflowers preserved in crystal-clear resin.", stock: 8, active: true },
  { id: 3, name: "Geode Crystal Art", price: 12000, medium: "Resin with Metallic Pigments", size: '18" × 18"', image: "https://image.qwenlm.ai/generated-images/641e1827-8b84-47e1-9bf7-b3ffa08cf423/_result.png", tag: "Exclusive", description: "Geode-inspired crystalline formations with gold accents.", stock: 3, active: true },
  { id: 4, name: "Galaxy Nebula Pour", price: 9500, medium: "Resin with Glitter", size: '20" × 16"', image: "https://image.qwenlm.ai/generated-images/e9c3ba9b-88ca-42d0-87de-62a0579273e1/_result.png", tag: "Featured", description: "Cosmic deep-space inspired swirls with starry glitter.", stock: 4, active: true },
  { id: 5, name: "Mountain Sunset Landscape", price: 11000, medium: "Layered Resin Art", size: '24" × 16"', image: "https://image.qwenlm.ai/generated-images/ffff3244-1707-48fa-9f6d-e57d89cc5726/_result.png", tag: "Limited", description: "Scenic mountain silhouette with sunset lake reflection.", stock: 2, active: true },
  { id: 6, name: "Marble Coaster Set (4)", price: 3500, medium: "Resin Coasters", size: '4" × 4" each', image: "https://image.qwenlm.ai/generated-images/870cef3d-b194-40f8-9d6e-9655e69108b4/_result.png", tag: "Gift Set", description: "Set of 4 handmade marble-effect resin coasters.", stock: 15, active: true },
];

const defaultOrders: AdminOrder[] = [
  {
    orderId: "RC1234567890",
    customerName: "Priya Sharma",
    email: "priya@example.com",
    phone: "9876543210",
    items: [{ name: "Ocean Wave Resin Art", price: 8500, quantity: 1 }],
    total: 10030,
    status: "delivered",
    paymentMethod: "UPI",
    date: "2026-01-15 14:30",
    address: "123 MG Road, Mumbai, Maharashtra - 400001",
  },
  {
    orderId: "RC1234567891",
    customerName: "Rajesh Kumar",
    email: "rajesh@example.com",
    phone: "9876543211",
    items: [
      { name: "Marble Coaster Set (4)", price: 3500, quantity: 2 },
      { name: "Botanical Flower Preserve", price: 6500, quantity: 1 },
    ],
    total: 16374,
    status: "shipped",
    paymentMethod: "Card",
    date: "2026-01-18 10:15",
    address: "45 Park Street, Delhi - 110001",
  },
  {
    orderId: "RC1234567892",
    customerName: "Anita Mehta",
    email: "anita@example.com",
    phone: "9876543212",
    items: [{ name: "Geode Crystal Art", price: 12000, quantity: 1 }],
    total: 14364,
    status: "confirmed",
    paymentMethod: "Net Banking",
    date: "2026-01-20 16:45",
    address: "78 Brigade Road, Bangalore, Karnataka - 560001",
  },
];

const defaultSettings: AdminSettings = {
  razorpayKeyId: "",
  razorpayKeySecret: "",
  merchantUpiId: "resincraft@upi",
  merchantName: "ResinCraft",
  merchantEmail: "support@resincraft.in",
  merchantPhone: "+919876543210",
  shippingFreeAbove: 5000,
  shippingCharge: 299,
  gstPercent: 18,
  currency: "INR",
  whatsappNumber: "+919876543210",
  callmebotApiKey: "",
  notificationMethod: "whatsapp_link",
  webhookURL: "",
  autoNotifyMerchant: true,
  emailjsServiceId: "",
  emailjsTemplateId: "",
  emailjsPublicKey: "",
  autoEmailCustomer: true,
  autoInvoiceOnShipping: true,
  autoWhatsappOnShipping: true,
};

// ==================== ADMIN PANEL ====================
export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "products" | "orders" | "settings">("dashboard");
  const [products, setProducts] = useState<AdminProduct[]>(() => getFromStorage("admin_products", defaultProducts));
  const [orders, setOrders] = useState<AdminOrder[]>(() => getFromStorage("admin_orders", defaultOrders));
  const [settings, setSettings] = useState<AdminSettings>(() => getFromStorage("admin_settings", defaultSettings));
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderFilter, setOrderFilter] = useState<string>("all");

  // Save to localStorage on changes
  useEffect(() => { saveToStorage("admin_products", products); }, [products]);
  useEffect(() => { saveToStorage("admin_orders", orders); }, [orders]);
  useEffect(() => { saveToStorage("admin_settings", settings); }, [settings]);

  // Stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
  const activeProducts = products.filter((p) => p.active).length;

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", icon: "fas fa-chart-line" },
    { id: "products" as const, label: "Products", icon: "fas fa-box" },
    { id: "orders" as const, label: "Orders", icon: "fas fa-shopping-cart" },
    { id: "settings" as const, label: "Settings", icon: "fas fa-cog" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0a0a1a] z-[100] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-[#0f0f23]/95 backdrop-blur-xl border-b border-indigo-500/10 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-shield-alt text-white"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold">ResinCraft Admin</h1>
              <p className="text-xs text-gray-300">Manage your store</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
          >
            <i className="fas fa-arrow-left"></i>
            Back to Store
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-300"
                  : "border-transparent text-gray-300 hover:text-gray-300"
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "dashboard" && (
          <DashboardView
            totalRevenue={totalRevenue}
            pendingOrders={pendingOrders}
            activeProducts={activeProducts}
            orders={orders}
            products={products}
          />
        )}

        {activeTab === "products" && (
          <ProductsView
            products={products}
            setProducts={setProducts}
            editingProduct={editingProduct}
            setEditingProduct={setEditingProduct}
            showAddProduct={showAddProduct}
            setShowAddProduct={setShowAddProduct}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        )}

        {activeTab === "orders" && (
          <OrdersView
            orders={orders}
            setOrders={setOrders}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            filter={orderFilter}
            setFilter={setOrderFilter}
            settings={settings}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView settings={settings} setSettings={setSettings} />
        )}
      </div>
    </motion.div>
  );
}

// ==================== DASHBOARD VIEW ====================
function DashboardView({
  totalRevenue,
  pendingOrders,
  activeProducts,
  orders,
  products,
}: {
  totalRevenue: number;
  pendingOrders: number;
  activeProducts: number;
  orders: AdminOrder[];
  products: AdminProduct[];
}) {
  const recentOrders = orders.slice(-5).reverse();
  const lowStockProducts = products.filter((p) => p.stock < 5 && p.active);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
        <p className="text-gray-300">Welcome back! Here's your store overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="fas fa-rupee-sign"
          label="Total Revenue"
          value={formatINR(totalRevenue)}
          color="from-green-500 to-emerald-600"
          change="+12.5%"
        />
        <StatCard
          icon="fas fa-shopping-bag"
          label="Total Orders"
          value={orders.length.toString()}
          color="from-indigo-500 to-purple-600"
          change="+3 this week"
        />
        <StatCard
          icon="fas fa-clock"
          label="Pending Orders"
          value={pendingOrders.toString()}
          color="from-yellow-500 to-orange-600"
          change="Needs attention"
        />
        <StatCard
          icon="fas fa-box"
          label="Active Products"
          value={activeProducts.toString()}
          color="from-pink-500 to-rose-600"
          change={`${products.length} total`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Orders</h3>
            <span className="text-xs text-gray-300">Last 5 orders</span>
          </div>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.orderId} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <i className="fas fa-shopping-bag text-indigo-400 text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{order.customerName}</p>
                  <p className="text-xs text-gray-300">{order.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatINR(order.total)}</p>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Low Stock Alert</h3>
            <span className="text-xs text-yellow-400">{lowStockProducts.length} items</span>
          </div>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <i className="fas fa-check-circle text-3xl text-green-400 mb-2"></i>
              <p>All products are well stocked!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                  <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-gray-300">{formatINR(product.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-yellow-400">{product.stock} left</p>
                    <p className="text-xs text-gray-300">Restock soon</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, change }: { icon: string; label: string; value: string; color: string; change: string }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
          <i className={`${icon} text-white text-lg`}></i>
        </div>
        <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">{change}</span>
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-sm text-gray-300">{label}</p>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: AdminOrder["status"] }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300",
    confirmed: "bg-blue-500/20 text-blue-300",
    shipped: "bg-purple-500/20 text-purple-300",
    delivered: "bg-green-500/20 text-green-300",
    cancelled: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}

// ==================== PRODUCTS VIEW ====================
function ProductsView({
  products,
  setProducts,
  editingProduct,
  setEditingProduct,
  showAddProduct,
  setShowAddProduct,
  searchTerm,
  setSearchTerm,
}: {
  products: AdminProduct[];
  setProducts: React.Dispatch<React.SetStateAction<AdminProduct[]>>;
  editingProduct: AdminProduct | null;
  setEditingProduct: (p: AdminProduct | null) => void;
  showAddProduct: boolean;
  setShowAddProduct: (v: boolean) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
}) {
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.medium.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleToggleActive = (id: number) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">Products</h2>
          <p className="text-gray-300">{products.length} total products • {products.filter((p) => p.active).length} active</p>
        </div>
        <button
          onClick={() => setShowAddProduct(true)}
          className="btn-primary px-5 py-2.5 rounded-full text-white font-medium flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Add New Product
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((product) => (
          <div key={product.id} className={`glass-card rounded-xl overflow-hidden ${!product.active ? "opacity-50" : ""}`}>
            <div className="relative aspect-video">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex gap-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${product.active ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                  {product.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold mb-1">{product.name}</h3>
              <p className="text-xs text-gray-300 mb-2">{product.medium} • {product.size}</p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-gradient">{formatINR(product.price)}</span>
                <span className="text-xs text-gray-300">Stock: {product.stock}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingProduct(product)}
                  className="flex-1 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm hover:bg-indigo-500/30 transition-colors"
                >
                  <i className="fas fa-edit mr-1"></i> Edit
                </button>
                <button
                  onClick={() => handleToggleActive(product.id)}
                  className="py-2 px-3 rounded-lg bg-yellow-500/20 text-yellow-300 text-sm hover:bg-yellow-500/30 transition-colors"
                  title={product.active ? "Deactivate" : "Activate"}
                >
                  <i className={`fas ${product.active ? "fa-eye-slash" : "fa-eye"}`}></i>
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="py-2 px-3 rounded-lg bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30 transition-colors"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {(showAddProduct || editingProduct) && (
          <ProductFormModal
            product={editingProduct}
            onClose={() => {
              setShowAddProduct(false);
              setEditingProduct(null);
            }}
            onSave={(product) => {
              if (editingProduct) {
                setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
              } else {
                setProducts((prev) => [...prev, { ...product, id: Math.max(...prev.map((p) => p.id)) + 1 }]);
              }
              setShowAddProduct(false);
              setEditingProduct(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductFormModal({
  product,
  onClose,
  onSave,
}: {
  product: AdminProduct | null;
  onClose: () => void;
  onSave: (product: AdminProduct) => void;
}) {
  const [form, setForm] = useState<AdminProduct>(
    product || {
      id: 0,
      name: "",
      price: 0,
      medium: "",
      size: "",
      image: "",
      tag: "New",
      description: "",
      stock: 10,
      active: true,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    onSave(form);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f0f23] border border-indigo-500/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{product ? "Edit Product" : "Add New Product"}</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
            <i className="fas fa-times text-gray-400"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">Product Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                placeholder="e.g., Ocean Wave Resin Art"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Price (₹) *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Stock Quantity</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Medium</label>
              <input
                type="text"
                value={form.medium}
                onChange={(e) => setForm({ ...form, medium: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                placeholder="e.g., Epoxy Resin on Wood"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Size</label>
              <input
                type="text"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                placeholder='e.g., 24" × 18"'
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Tag</label>
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              >
                <option value="New" className="bg-[#0f0f23]">New</option>
                <option value="Bestseller" className="bg-[#0f0f23]">Bestseller</option>
                <option value="Featured" className="bg-[#0f0f23]">Featured</option>
                <option value="Limited" className="bg-[#0f0f23]">Limited</option>
                <option value="Exclusive" className="bg-[#0f0f23]">Exclusive</option>
                <option value="Gift Set" className="bg-[#0f0f23]">Gift Set</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Active</label>
              <select
                value={form.active ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, active: e.target.value === "yes" })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              >
                <option value="yes" className="bg-[#0f0f23]">Yes - Show on website</option>
                <option value="no" className="bg-[#0f0f23]">No - Hide from website</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">Image URL</label>
              <input
                type="url"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Describe your product..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 rounded-full text-white font-medium">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 py-3 rounded-full text-white font-medium">
              {product ? "Save Changes" : "Add Product"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ==================== ORDERS VIEW ====================
function OrdersView({
  orders,
  setOrders,
  selectedOrder,
  setSelectedOrder,
  filter,
  setFilter,
  settings,
}: {
  orders: AdminOrder[];
  setOrders: React.Dispatch<React.SetStateAction<AdminOrder[]>>;
  selectedOrder: AdminOrder | null;
  setSelectedOrder: (o: AdminOrder | null) => void;
  filter: string;
  setFilter: (f: string) => void;
  settings: AdminSettings;
}) {
  const filteredOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const [shipForm, setShipForm] = useState({ courier: "", awb: "", expectedDelivery: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      setShipForm({
        courier: selectedOrder.courier || "",
        awb: selectedOrder.awb || "",
        expectedDelivery: selectedOrder.expectedDelivery || "",
      });
    }
  }, [selectedOrder?.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- helpers -----------------------------------------------------------

  const toNotifyOrder = (order: AdminOrder, extra?: Partial<NotifyOrder>): NotifyOrder => ({
    orderId: order.orderId,
    date: order.date,
    items: order.items,
    customer: {
      fullName: order.customerName,
      email: order.email,
      phone: order.phone,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      country: "India",
    },
    paymentMethod: order.paymentMethod,
    total: order.total,
    subtotal: order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0),
    shippingCost: order.shippingCost ?? 0,
    tax: order.tax ?? 0,
    ...extra,
  });

  const merchant = () => ({
    email: settings.merchantEmail || "support@resincraft.in",
    phone: settings.merchantPhone || "",
  });

  const sendCustomerStatusEmail = async (order: AdminOrder, status: AdminOrder["status"]) => {
    if (!settings.autoEmailCustomer) return;
    const { emailjsServiceId, emailjsTemplateId, emailjsPublicKey } = settings;
    if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey) {
      console.warn("EmailJS not configured — status email skipped.");
      return;
    }

    // 📄 The invoice is generated ONLY when the order is marked as SHIPPED.
    const notify = toNotifyOrder(order);
    let html = "";
    let text = "";
    let subject = "";
    if (status === "shipped") {
      subject = notifySubject.shipped(order.orderId);
      html = buildShipmentEmailHTML(notify, merchant()); // includes the tax invoice
      text = buildShipmentEmailText(notify, merchant());
    } else if (status === "delivered") {
      subject = notifySubject.delivered(order.orderId);
      html = buildDeliveredEmailHTML(notify, merchant());
      text = buildDeliveredEmailText(notify, merchant());
    } else if (status === "cancelled") {
      subject = notifySubject.cancelled(order.orderId);
      html = buildCancelledEmailHTML(notify, merchant());
      text = buildCancelledEmailText(notify, merchant());
    } else {
      return;
    }

    try {
      await emailjs.send(
        emailjsServiceId,
        emailjsTemplateId,
        {
          to_email: order.email,
          to_name: order.customerName,
          from_name: "ResinCraft",
          reply_to: merchant().email,
          subject,
          message: text,
          html_message: html,
          order_id: order.orderId,
          order_total: formatINR(order.total),
          order_date: order.date,
        },
        emailjsPublicKey
      );
      console.log(`✅ Professional ${status} email sent to ${order.email}`);
    } catch (error) {
      console.error("❌ Failed to send status email:", error);
    }
  };

  // Opens WhatsApp with a professionally formatted shipping message for the customer.
  // (wa.me links cannot carry raw HTML — this is WhatsApp's own rich-text format.)
  const openCustomerWhatsApp = (order: AdminOrder) => {
    const notify = toNotifyOrder(order);
    const url = buildWhatsappLink(order.phone, whatsappTemplates.shipped(notify));
    window.open(url, "_blank");
  };

  const openMerchantWhatsApp = (order: AdminOrder) => {
    const notify = toNotifyOrder(order);
    const url = buildWhatsappLink(settings.whatsappNumber, whatsappTemplates.shipped(notify));
    window.open(url, "_blank");
  };

  const generateInvoiceFile = (order: AdminOrder) => {
    // Invoice generation is only allowed AFTER the item is shipped.
    if (order.status !== "shipped" && order.status !== "delivered") {
      alert("The invoice can be generated only after the order is marked as Shipped.");
      return;
    }
    const notify = toNotifyOrder(order);
    const html = buildShipmentEmailHTML(notify, merchant()); // full professional invoice layout
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* user can print manually */ } }, 500);
  };

  // ---- status transitions ------------------------------------------------

  const markShipped = async () => {
    if (!selectedOrder) return;
    setBusy(true);
    const now = new Date();
    const eta = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
      year: "numeric", month: "short", day: "numeric",
    });
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${selectedOrder.orderId.replace(/^RC/, "").slice(-6)}`;
    const shipped: AdminOrder = {
      ...selectedOrder,
      status: "shipped",
      courier: shipForm.courier.trim() || selectedOrder.courier || "India Post / Delhivery",
      awb: shipForm.awb.trim() || selectedOrder.awb || String(Date.now()).slice(-11),
      expectedDelivery: shipForm.expectedDelivery.trim() || selectedOrder.expectedDelivery || eta,
      shippedAt: now.toLocaleString("en-IN"),
      // 🧾 Tax invoice is generated at this exact moment — never before shipping.
      invoiceNumber,
      invoiceGeneratedAt: now.toLocaleString("en-IN"),
    };

    setOrders((prev) => prev.map((o) => (o.orderId === shipped.orderId ? shipped : o)));
    setSelectedOrder(shipped);

    // Automatic, professional notifications on ship-out
    if (settings.autoInvoiceOnShipping !== false) {
      await sendCustomerStatusEmail(shipped, "shipped"); // HTML email WITH the invoice
    }
    if (settings.autoWhatsappOnShipping !== false) {
      openCustomerWhatsApp(shipped); // opens WhatsApp with the formatted shipping message
    }
    setBusy(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: AdminOrder["status"]) => {
    const current = orders.find((o) => o.orderId === orderId) || selectedOrder;
    if (!current) return;

    // Marking as SHIPPED must go through the shipment form (tracking details + invoice).
    // Just re-open/focus the order so the admin uses the dedicated "Mark Shipped" action.
    if (newStatus === "shipped" && current.status !== "shipped") {
      setSelectedOrder(current);
      return;
    }

    const updated: AdminOrder = { ...current, status: newStatus };

    // 🔄 AUTOMATIC payment completion for direct-UPI orders: when the merchant confirms
    // in their bank statement that the money arrived, marking the order "Paid" records the
    // transaction in the UPI ledger. The customer's open checkout tab detects it instantly
    // (BroadcastChannel) — or on their next visit within the intent window — and places the
    // order automatically. No manual reference entry by the customer, ever.
    if (newStatus === "confirmed" && current.paymentStatus !== "paid" && /upi/i.test(current.paymentMethod || "")) {
      await markUpiPaymentReceived(updated);
      return;
    }

    const setOrdersSafe = (o: AdminOrder) =>
      setOrders((prev) => prev.map((x) => (x.orderId === o.orderId ? o : x)));

    setOrdersSafe(updated);
    if (selectedOrder && selectedOrder.orderId === orderId) setSelectedOrder(updated);

    // Professional HTML email for delivered / cancelled transitions
    await sendCustomerStatusEmail(updated, newStatus);
  };

  // Record a merchant-confirmed UPI payment: marks the admin order paid + feeds the
  // automatic verification ledger that the checkout polls.
  const markUpiPaymentReceived = async (order: AdminOrder) => {
    const tr = order.upiTransactionRef || "";
    const bankRef = `RRN${Date.now().toString().slice(-10)}`; // auto-generated record ref (merchant can note the real RRN below)
    if (tr) {
      try {
        const recs: any[] = JSON.parse(localStorage.getItem("upi_txn_ledger") || "[]");
        const full = { tr, status: "success", rrn: bankRef, amt: order.total, vpa: settings.merchantUpiId || "", ts: Date.now(), source: "merchant-confirmation" };
        const idx = recs.findIndex((r) => r.tr === tr);
        if (idx >= 0) recs[idx] = full; else recs.push(full);
        localStorage.setItem("upi_txn_ledger", JSON.stringify(recs.slice(-200)));
        try { window.dispatchEvent(new CustomEvent("upi-txn-recorded", { detail: full })); } catch {}
        try { new BroadcastChannel("upi-txn-ledger").postMessage(full); } catch {}
      } catch {}
    }
    const updated: AdminOrder = { ...order, status: "confirmed", paymentStatus: "paid", upiBankRef: bankRef };
    setOrders((prev) => prev.map((x) => (x.orderId === order.orderId ? updated : x)));
    if (selectedOrder && selectedOrder.orderId === order.orderId) setSelectedOrder(updated);
    await sendCustomerStatusEmail(updated, "confirmed");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Orders</h2>
        <p className="text-gray-300">{orders.length} total orders</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "confirmed", "shipped", "delivered", "cancelled"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${
              filter === status ? "bg-indigo-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {status} {status !== "all" && `(${orders.filter((o) => o.status === status).length})`}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <i className="fas fa-inbox text-4xl mb-3"></i>
            <p>No orders found</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.orderId}
              onClick={() => setSelectedOrder(order)}
              className="glass-card rounded-xl p-4 cursor-pointer hover:border-indigo-500/30 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm text-indigo-300">{order.orderId}</span>
                    <OrderStatusBadge status={order.status} />
                    {order.paymentStatus === "paid" && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                        <i className="fas fa-check-circle mr-1"></i>Paid
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-xs text-gray-300">{order.email} • {order.phone}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gradient">{formatINR(order.total)}</p>
                    <p className="text-xs text-gray-300">{order.items.length} item(s)</p>
                  </div>
                  <div className="text-right text-xs text-gray-300">
                    <p>{order.date}</p>
                    <p className="capitalize">{order.paymentMethod}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdateStatus={(status) => updateOrderStatus(selectedOrder.orderId, status)}
            shipForm={shipForm}
            setShipForm={setShipForm}
            onMarkShipped={markShipped}
            busy={busy}
            onSendShippingWhatsApp={() => openCustomerWhatsApp(selectedOrder)}
            onNotifyMerchantWhatsApp={() => openMerchantWhatsApp(selectedOrder)}
            onGenerateInvoice={() => generateInvoiceFile(selectedOrder)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onUpdateStatus,
  shipForm,
  setShipForm,
  onMarkShipped,
  busy,
  onSendShippingWhatsApp,
  onNotifyMerchantWhatsApp,
  onGenerateInvoice,
}: {
  order: AdminOrder;
  onClose: () => void;
  onUpdateStatus: (status: AdminOrder["status"]) => void;
  shipForm: { courier: string; awb: string; expectedDelivery: string };
  setShipForm: React.Dispatch<React.SetStateAction<{ courier: string; awb: string; expectedDelivery: string }>>;
  onMarkShipped: () => void;
  busy: boolean;
  onSendShippingWhatsApp: () => void;
  onNotifyMerchantWhatsApp: () => void;
  onGenerateInvoice: () => void;
}) {
  const isShipped = order.status === "shipped" || order.status === "delivered";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f0f23] border border-indigo-500/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Order Details</h2>
            <p className="text-sm text-indigo-300 font-mono">{order.orderId}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
            <i className="fas fa-times text-gray-400"></i>
          </button>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="glass-card rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Update Status</label>
            <select
              value={order.status}
              onChange={(e) => onUpdateStatus(e.target.value as AdminOrder["status"])}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            >
              <option value="pending" className="bg-[#0f0f23]">Pending</option>
              <option value="confirmed" className="bg-[#0f0f23]">Confirmed</option>
              <option value="shipped" className="bg-[#0f0f23]">Shipped</option>
              <option value="delivered" className="bg-[#0f0f23]">Delivered</option>
              <option value="cancelled" className="bg-[#0f0f23]">Cancelled</option>
            </select>
            <p className="text-xs text-gray-400 mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Selecting <strong>Shipped</strong> uses the shipment form below — the tax invoice is generated and emailed only at that moment.
            </p>
          </div>

          {/* Shipment Details & Invoice */}
          <div className="glass-card rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <i className="fas fa-truck-fast text-indigo-400"></i>
              Shipment &amp; Invoice
              {isShipped ? (
                <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Invoice {order.invoiceNumber || "Generated"}
                </span>
              ) : (
                <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                  Invoice pending — ships first
                </span>
              )}
            </h3>

            {isShipped ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-300">Courier</p><p className="font-medium">{order.courier || "—"}</p></div>
                <div><p className="text-gray-300">AWB / Tracking</p><p className="font-medium font-mono">{order.awb || "—"}</p></div>
                <div><p className="text-gray-300">Shipped On</p><p className="font-medium">{order.shippedAt || "—"}</p></div>
                <div><p className="text-gray-300">Expected Delivery</p><p className="font-medium">{order.expectedDelivery || "—"}</p></div>
                <div className="col-span-2 pt-2 flex gap-3">
                  <button onClick={onGenerateInvoice} className="flex-1 py-2.5 rounded-full bg-purple-500/20 text-purple-300 font-medium hover:bg-purple-500/30 transition-colors text-sm">
                    <i className="fas fa-file-invoice-dollar mr-2"></i>View / Print Invoice
                  </button>
                  <button onClick={onSendShippingWhatsApp} className="flex-1 py-2.5 rounded-full bg-green-500/20 text-green-300 font-medium hover:bg-green-500/30 transition-colors text-sm">
                    <i className="fab fa-whatsapp mr-2"></i>Resend Shipping WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Courier (e.g. Delhivery)"
                    value={shipForm.courier}
                    onChange={(e) => setShipForm({ ...shipForm, courier: e.target.value })}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="AWB / Tracking No."
                    value={shipForm.awb}
                    onChange={(e) => setShipForm({ ...shipForm, awb: e.target.value })}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Expected delivery date (optional)"
                  value={shipForm.expectedDelivery}
                  onChange={(e) => setShipForm({ ...shipForm, expectedDelivery: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 text-sm"
                />
                <button
                  onClick={onMarkShipped}
                  disabled={busy}
                  className="w-full py-3 rounded-full btn-primary text-white font-medium disabled:opacity-50"
                >
                  <i className="fas fa-shipping-fast mr-2"></i>
                  {busy ? "Sending notifications…" : "Mark Shipped — Generate Invoice & Notify Customer"}
                </button>
                <p className="text-xs text-gray-400">
                  This automatically emails the customer a professional HTML shipping notification with the tax invoice, and opens the formatted WhatsApp message.
                </p>
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="glass-card rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <i className="fas fa-user text-indigo-400"></i>
              Customer Details
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-300">Name</p>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-gray-300">Phone</p>
                <p className="font-medium">{order.phone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-300">Email</p>
                <p className="font-medium">{order.email}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-300">Address</p>
                <p className="font-medium">{order.address}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="glass-card rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <i className="fas fa-box text-indigo-400"></i>
              Items ({order.items.length})
            </h3>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-300">Qty: {item.quantity} × {formatINR(item.price)}</p>
                  </div>
                  <p className="font-semibold">{formatINR(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 mt-3 pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-gradient">{formatINR(order.total)}</span>
            </div>
          </div>

          {/* Payment & Date */}
          <div className="glass-card rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-300">Payment Method</p>
                <p className="font-medium capitalize">{order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-gray-300">Payment Status</p>
                <p className={`font-medium ${order.paymentStatus === "paid" ? "text-green-400" : order.paymentStatus === "failed" ? "text-red-400" : "text-yellow-300"}`}>
                  {order.paymentStatus === "paid" ? "Paid • Successful" : order.paymentStatus === "failed" ? "Failed" : order.paymentStatus === "pending" ? "Pending" : "—"}
                </p>
              </div>
              <div>
                <p className="text-gray-300">Order Date</p>
                <p className="font-medium">{order.date}</p>
              </div>
            </div>
            {/* UPI automatic verification record (kept for audit — customer never enters anything) */}
            {(order.upiTransactionRef || order.upiBankRef) && (
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-xs font-mono text-gray-300">
                {order.upiTransactionRef && (
                  <p><span className="text-gray-400 font-sans">UPI Txn Ref (tr):</span> {order.upiTransactionRef}</p>
                )}
                {order.upiBankRef && (
                  <p><span className="text-gray-400 font-sans">Bank Ref (auto-recorded):</span> {order.upiBankRef}</p>
                )}
              </div>
            )}
          </div>

          {/* Actions — professionally formatted notifications */}
          <div className="flex gap-3">
            <button
              onClick={onSendShippingWhatsApp}
              disabled={!isShipped}
              title={isShipped ? "Open WhatsApp with the formatted shipping message" : "Available after the order is shipped"}
              className="flex-1 py-3 rounded-full bg-green-500/20 text-green-300 font-medium text-center hover:bg-green-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fab fa-whatsapp mr-2"></i>
              WhatsApp to Customer
            </button>
            <button
              onClick={onNotifyMerchantWhatsApp}
              className="flex-1 py-3 rounded-full bg-indigo-500/20 text-indigo-300 font-medium text-center hover:bg-indigo-500/30 transition-colors"
            >
              <i className="fas fa-bell mr-2"></i>
              Notify Me (WhatsApp)
            </button>
          </div>
          {!isShipped && (
            <p className="text-xs text-gray-400 text-center">
              <i className="fas fa-lock mr-1"></i>
              Invoice &amp; shipping notifications unlock once the order is marked as Shipped.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==================== SETTINGS VIEW ====================
function SettingsView({
  settings,
  setSettings,
}: {
  settings: AdminSettings;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings>>;
}) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold mb-2">Settings</h2>
        <p className="text-gray-300">Configure your store and payment gateway</p>
      </div>

      {/* Payment Gateway */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-credit-card text-indigo-400"></i>
          Payment Gateway (Razorpay)
        </h3>
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
          <p className="text-xs text-yellow-300">
            <i className="fas fa-info-circle mr-1"></i>
            Get your API keys from <a href="https://dashboard.razorpay.com" target="_blank" rel="noreferrer" className="underline">dashboard.razorpay.com</a>. Leave empty to use demo mode.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Razorpay Key ID</label>
            <input
              type="text"
              value={settings.razorpayKeyId}
              onChange={(e) => setSettings({ ...settings, razorpayKeyId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
              placeholder="rzp_test_XXXXXXXXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Razorpay Key Secret</label>
            <input
              type="password"
              value={settings.razorpayKeySecret}
              onChange={(e) => setSettings({ ...settings, razorpayKeySecret: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
              placeholder="••••••••••••••••"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Merchant UPI ID (VPA) — used for UPI deep links &amp; QR at checkout</label>
            <input
              type="text"
              value={settings.merchantUpiId}
              onChange={(e) => setSettings({ ...settings, merchantUpiId: e.target.value.trim() })}
              className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                settings.merchantUpiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(settings.merchantUpiId)
                  ? "border-red-500"
                  : "border-white/10"
              } text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm`}
              placeholder="yourstore@okhdfcbank / business@upi"
            />
            {settings.merchantUpiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(settings.merchantUpiId) ? (
              <p className="text-red-400 text-xs mt-1">Invalid UPI ID format (example: name@bank)</p>
            ) : (
              <p className="text-gray-300 text-xs mt-1">
                Customers pay this UPI ID directly when they choose "Open &amp; Pay via UPI App". Set your real, verified UPI ID here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Merchant Info */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-store text-indigo-400"></i>
          Merchant Information
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Business Name</label>
            <input
              type="text"
              value={settings.merchantName}
              onChange={(e) => setSettings({ ...settings, merchantName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={settings.merchantEmail}
                onChange={(e) => setSettings({ ...settings, merchantEmail: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Phone</label>
              <input
                type="tel"
                value={settings.merchantPhone}
                onChange={(e) => setSettings({ ...settings, merchantPhone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">WhatsApp Number (for order notifications)</label>
            <input
              type="tel"
              value={settings.whatsappNumber}
              onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              placeholder="+919876543210"
            />
          </div>
        </div>
      </div>

      {/* 📱 Order Notifications */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-bell text-indigo-400"></i>
          Order Notifications (Get alerts when customer orders)
        </h3>
        
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
          <p className="text-xs text-green-300">
            <i className="fas fa-check-circle mr-1"></i>
            When enabled, you'll automatically receive a message on WhatsApp/Email whenever a customer places an order.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoNotifyMerchant}
                onChange={(e) => setSettings({ ...settings, autoNotifyMerchant: e.target.checked })}
                className="w-5 h-5 accent-indigo-500"
              />
              <div>
                <p className="font-medium">Enable Auto Notifications</p>
                <p className="text-xs text-gray-300">Receive alerts when new orders come in</p>
              </div>
            </label>
          </div>

          {settings.autoNotifyMerchant && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pl-8"
            >
              <div>
                <label className="block text-sm text-gray-400 mb-2">Notification Method</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="radio"
                      name="notificationMethod"
                      value="whatsapp_link"
                      checked={settings.notificationMethod === "whatsapp_link"}
                      onChange={(e) => setSettings({ ...settings, notificationMethod: e.target.value as any })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        <i className="fab fa-whatsapp text-green-400"></i>
                        WhatsApp (Opens WhatsApp Web/App)
                        <span className="ml-2 px-2 py-0.5 rounded bg-green-500/20 text-[10px] text-green-300">RECOMMENDED</span>
                      </p>
                      <p className="text-xs text-gray-300">Automatically opens WhatsApp with order details - you just click Send</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="radio"
                      name="notificationMethod"
                      value="email"
                      checked={settings.notificationMethod === "email"}
                      onChange={(e) => setSettings({ ...settings, notificationMethod: e.target.value as any })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        <i className="fas fa-envelope text-blue-400"></i>
                        Email Only
                      </p>
                      <p className="text-xs text-gray-300">Send order details to your email</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="radio"
                      name="notificationMethod"
                      value="both"
                      checked={settings.notificationMethod === "both"}
                      onChange={(e) => setSettings({ ...settings, notificationMethod: e.target.value as any })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        <i className="fas fa-bell text-purple-400"></i>
                        Both WhatsApp + Email
                      </p>
                      <p className="text-xs text-gray-300">Get notified on both platforms</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 cursor-pointer hover:bg-green-500/20 transition-colors">
                    <input
                      type="radio"
                      name="notificationMethod"
                      value="callmebot_auto"
                      checked={settings.notificationMethod === "callmebot_auto"}
                      onChange={(e) => setSettings({ ...settings, notificationMethod: e.target.value as any })}
                      className="w-4 h-4 accent-green-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        <i className="fas fa-robot text-green-400"></i>
                        100% Automatic (CallMeBot - FREE)
                        <span className="ml-2 px-2 py-0.5 rounded bg-green-500/30 text-[10px] text-green-200 font-bold">RECOMMENDED</span>
                      </p>
                      <p className="text-xs text-gray-400">Completely automatic - you receive WhatsApp message instantly without any action!</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="radio"
                      name="notificationMethod"
                      value="api_auto"
                      checked={settings.notificationMethod === "api_auto"}
                      onChange={(e) => setSettings({ ...settings, notificationMethod: e.target.value as any })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        <i className="fas fa-robot text-pink-400"></i>
                        Webhook/API (Advanced)
                        <span className="ml-2 px-2 py-0.5 rounded bg-pink-500/20 text-[10px] text-pink-300">ADVANCED</span>
                      </p>
                      <p className="text-xs text-gray-300">For developers - use Pipedream, Make.com, or custom webhook</p>
                    </div>
                  </label>
                </div>
              </div>

              {settings.notificationMethod === "callmebot_auto" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-300 mb-2">
                      <i className="fas fa-check-circle mr-1"></i>
                      <strong>100% Automatic & FREE!</strong> CallMeBot sends WhatsApp messages directly to your phone. No manual work needed!
                    </p>
                    <p className="text-xs text-gray-400">
                      Setup takes 2 minutes. See CALLMEBOT_SETUP.md for step-by-step guide.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Your WhatsApp Number</label>
                    <input
                      type="tel"
                      value={settings.whatsappNumber}
                      onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                      placeholder="+919876543210"
                    />
                    <p className="text-xs text-gray-300 mt-1">Include country code (e.g., +91 for India)</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">CallMeBot API Key</label>
                    <input
                      type="text"
                      value={settings.callmebotApiKey}
                      onChange={(e) => setSettings({ ...settings, callmebotApiKey: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                      placeholder="Your API key from CallMeBot"
                    />
                    <p className="text-xs text-gray-300 mt-1">Get your free API key from callmebot.com (see guide)</p>
                  </div>
                </motion.div>
              )}

              {settings.notificationMethod === "api_auto" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-300 mb-2">
                      <i className="fas fa-info-circle mr-1"></i>
                      <strong>Advanced Setup:</strong> Use Pipedream, Make.com, or Zapier for custom automation workflows.
                    </p>
                    <p className="text-xs text-gray-400">
                      Requires technical knowledge. See AUTOMATIC_WHATSAPP_GUIDE.md for instructions.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Webhook URL</label>
                    <input
                      type="url"
                      value={settings.webhookURL}
                      onChange={(e) => setSettings({ ...settings, webhookURL: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                      placeholder="https://your-webhook-url.com/endpoint"
                    />
                  </div>
                </motion.div>
              )}

              {(settings.notificationMethod === "whatsapp_link" || settings.notificationMethod === "both") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your WhatsApp Number (to receive order alerts)</label>
                  <input
                    type="tel"
                    value={settings.whatsappNumber}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                    placeholder="+919876543210"
                  />
                  <p className="text-xs text-gray-300 mt-1">Format: +91 followed by 10-digit number</p>
                </div>
              )}

              {(settings.notificationMethod === "email" || settings.notificationMethod === "both") && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Email (to receive order alerts)</label>
                  <input
                    type="email"
                    value={settings.merchantEmail}
                    onChange={(e) => setSettings({ ...settings, merchantEmail: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                    placeholder="your@email.com"
                  />
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Shipping & Tax */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-truck text-indigo-400"></i>
          Shipping & Tax
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Free Shipping Above (₹)</label>
            <input
              type="number"
              value={settings.shippingFreeAbove}
              onChange={(e) => setSettings({ ...settings, shippingFreeAbove: Number(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Shipping Charge (₹)</label>
            <input
              type="number"
              value={settings.shippingCharge}
              onChange={(e) => setSettings({ ...settings, shippingCharge: Number(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">GST %</label>
            <input
              type="number"
              value={settings.gstPercent}
              onChange={(e) => setSettings({ ...settings, gstPercent: Number(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-envelope text-indigo-400"></i>
          Email Notifications (Auto-send Invoice to Customers)
        </h3>
        
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
          <p className="text-xs text-blue-300">
            <i className="fas fa-info-circle mr-1"></i>
            Automatically send beautiful HTML invoice emails to customers when they place an order. Powered by EmailJS (FREE for 200 emails/month).
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoEmailCustomer}
                onChange={(e) => setSettings({ ...settings, autoEmailCustomer: e.target.checked })}
                className="w-5 h-5 accent-indigo-500"
              />
              <div>
                <p className="font-medium">Enable Auto Email to Customers</p>
                <p className="text-xs text-gray-300">Send order confirmation (on payment) &amp; shipping + invoice emails (on ship-out) automatically</p>
              </div>
            </label>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoInvoiceOnShipping !== false}
                onChange={(e) => setSettings({ ...settings, autoInvoiceOnShipping: e.target.checked })}
                className="w-5 h-5 accent-indigo-500"
              />
              <div>
                <p className="font-medium">Auto-generate &amp; email invoice when order is marked SHIPPED</p>
                <p className="text-xs text-gray-300">The tax invoice is created ONLY after shipment — never at checkout</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoWhatsappOnShipping !== false}
                onChange={(e) => setSettings({ ...settings, autoWhatsappOnShipping: e.target.checked })}
                className="w-5 h-5 accent-green-500"
              />
              <div>
                <p className="font-medium">Auto-send WhatsApp shipping notification on ship-out</p>
                <p className="text-xs text-gray-300">Opens a professionally formatted WhatsApp message to the customer with tracking details</p>
              </div>
            </label>
          </div>

          {settings.autoEmailCustomer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pl-8"
            >
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-300 mb-2">
                  <i className="fas fa-lightbulb mr-1"></i>
                  <strong>Setup Required:</strong> Create a free EmailJS account and get your credentials. In your EmailJS template, add variables named <code className="text-yellow-200">subject</code>, <code className="text-yellow-200">message</code> and <code className="text-yellow-200">html_message</code> (e.g. {"{{subject}"} , {"{{message}"} , {"{{html_message}"} ) so the professionally formatted HTML emails render correctly. See EMAIL_SETUP.md for a step-by-step guide.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">EmailJS Service ID</label>
                <input
                  type="text"
                  value={settings.emailjsServiceId}
                  onChange={(e) => setSettings({ ...settings, emailjsServiceId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  placeholder="service_xxxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">EmailJS Template ID</label>
                <input
                  type="text"
                  value={settings.emailjsTemplateId}
                  onChange={(e) => setSettings({ ...settings, emailjsTemplateId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  placeholder="template_xxxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">EmailJS Public Key</label>
                <input
                  type="text"
                  value={settings.emailjsPublicKey}
                  onChange={(e) => setSettings({ ...settings, emailjsPublicKey: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  placeholder="xxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="btn-primary w-full py-3.5 rounded-full text-white font-medium"
      >
        {saved ? "✓ Settings Saved!" : "Save All Settings"}
      </button>
    </div>
  );
}
