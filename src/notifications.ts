// ==================== PROFESSIONAL NOTIFICATION TEMPLATES ====================
// All WhatsApp messages and emails generated here are HTML-formatted with a
// clean, professional layout (inline CSS only — safe for email clients).

export interface NotifyOrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface NotifyCustomer {
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface NotifyOrder {
  orderId: string;
  date: string;
  items: NotifyOrderItem[];
  customer: NotifyCustomer;
  paymentMethod: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  awb?: string;
  courier?: string;
  expectedDelivery?: string;
}

const BRAND = "#6366f1";
const BRAND_DARK = "#4f46e5";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const escapeHtml = (value: unknown): string => {
  const str = value == null ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
};

const formatDateTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const initials = (name: string): string => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RC";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
};

// ---------- shared building blocks ----------

const headerBlock = (title: string, subtitle: string) => `
  <tr>
    <td style="background: linear-gradient(135deg, ${BRAND} 0%, #7c3aed 100%); padding: 36px 32px; text-align: center;">
      <div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">RESIN<span style="opacity:.85">CRAFT</span></div>
      <div style="font-size: 12px; color: rgba(255,255,255,.75); letter-spacing: 3px; text-transform: uppercase; margin-top: 6px;">Handmade Resin Art</div>
      <div style="margin-top: 22px; font-size: 20px; font-weight: 700; color: #ffffff;">${escapeHtml(title)}</div>
      <div style="font-size: 13px; color: rgba(255,255,255,.85); margin-top: 4px;">${escapeHtml(subtitle)}</div>
    </td>
  </tr>`;

const metaRow = (order: NotifyOrder, statusLabel: string, statusBg: string, statusColor: string) => `
  <tr>
    <td style="padding: 24px 32px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr>
          <td style="padding:18px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:50%;padding:6px 0;vertical-align:top;">
                  <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Order ID</div>
                  <div style="font-size:15px;color:#0f172a;font-weight:700;font-family:'Courier New',monospace;">${escapeHtml(order.orderId)}</div>
                </td>
                <td style="width:50%;padding:6px 0;text-align:right;vertical-align:top;">
                  <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Date</div>
                  <div style="font-size:15px;color:#0f172a;font-weight:600;">${escapeHtml(formatDate(order.date))}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;vertical-align:top;">
                  <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Payment Method</div>
                  <div style="font-size:15px;color:#0f172a;font-weight:600;text-transform:capitalize;">${escapeHtml(order.paymentMethod || "—")}</div>
                </td>
                <td style="padding:6px 0;text-align:right;vertical-align:top;">
                  <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Status</div>
                  <span style="display:inline-block;padding:4px 14px;background-color:${statusBg};color:${statusColor};border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(statusLabel)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

const greetingBlock = (customerName: string, paragraphs: string[]) => `
  <tr>
    <td style="padding: 24px 32px 8px;">
      <div style="font-size:16px;color:#0f172a;font-weight:700;margin-bottom:10px;">Dear ${escapeHtml(customerName || "Customer")},</div>
      ${paragraphs
        .map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#475569;">${p}</p>`)
        .join("")}
    </td>
  </tr>`;

const itemsTable = (items: NotifyOrderItem[], accent: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <thead>
      <tr style="background-color:${accent};">
        <th style="padding:12px 14px;text-align:left;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;">Item</th>
        <th style="padding:12px 8px;text-align:center;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;width:60px;">Qty</th>
        <th style="padding:12px 14px;text-align:right;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;width:100px;">Unit Price</th>
        <th style="padding:12px 14px;text-align:right;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;width:110px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item, i) => `
      <tr style="background-color:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
        <td style="padding:13px 14px;border-top:1px solid #eef2f7;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(item.name)}</td>
        <td style="padding:13px 8px;border-top:1px solid #eef2f7;font-size:14px;color:#334155;text-align:center;">${item.quantity}</td>
        <td style="padding:13px 14px;border-top:1px solid #eef2f7;font-size:14px;color:#334155;text-align:right;">${inr(item.price)}</td>
        <td style="padding:13px 14px;border-top:1px solid #eef2f7;font-size:14px;color:#0f172a;font-weight:700;text-align:right;">${inr(item.price * item.quantity)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>`;

const totalsBlock = (order: NotifyOrder) => {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = order.shippingCost ?? 0;
  const tax = order.tax ?? 0;
  const total = order.total ?? subtotal + shipping + tax;
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:${strong ? "14px 0 4px" : "7px 0"};${strong ? "border-top:2px solid #e2e8f0;" : ""}font-size:${strong ? "16px" : "14px"};color:${strong ? "#0f172a" : "#64748b"};font-weight:${strong ? "800" : "500"};">${label}</td>
      <td style="padding:${strong ? "14px 0 4px" : "7px 0"};${strong ? "border-top:2px solid #e2e8f0;" : ""}text-align:right;font-size:${strong ? "18px" : "14px"};color:${strong ? BRAND_DARK : "#0f172a"};font-weight:${strong ? "800" : "600"};">${value}</td>
    </tr>`;
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
    <tr><td style="padding:18px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Subtotal", inr(subtotal))}
        ${row("Shipping", shipping === 0 ? '<span style="color:#059669;font-weight:700;">FREE</span>' : inr(shipping))}
        ${row("GST", inr(tax))}
        ${row("Total Amount Paid", inr(total), true)}
      </table>
    </td></tr>
  </table>`;
};

const addressBlock = (customer: NotifyCustomer) => {
  const addrLines = [customer.address, [customer.city, customer.state, customer.pincode].filter(Boolean).join(", "), customer.country]
    .filter(Boolean)
    .join("<br>");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
    <tr><td style="padding:18px 20px;font-size:14px;line-height:1.7;color:#334155;">
      <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">${escapeHtml(customer.fullName || "—")}</div>
      ${addrLines ? escapeHtml(customer.address || "").concat("<br>") + escapeHtml([customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")) + (customer.country ? "<br>" + escapeHtml(customer.country) : "") : "—"}
      <div style="margin-top:8px;color:#64748b;">📞 ${escapeHtml(customer.phone || "—")} &nbsp;•&nbsp; ✉️ ${escapeHtml(customer.email || "—")}</div>
    </td></tr>
  </table>`;
};

const buttonBlock = (label: string, url: string) => `
  <tr>
    <td style="padding: 8px 32px 28px;" align="center">
      <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"
         style="display:inline-block;background:linear-gradient(135deg, ${BRAND} 0%, #7c3aed 100%);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 34px;border-radius:999px;letter-spacing:.3px;">${escapeHtml(label)}</a>
    </td>
  </tr>`;

const footerBlock = (merchantEmail: string, merchantPhone: string) => `
  <tr>
    <td style="padding: 24px 32px; border-top: 1px solid #e2e8f0;">
      <div style="font-size:13px;color:#0f172a;font-weight:700;margin-bottom:6px;">Need assistance? Our team is happy to help.</div>
      <div style="font-size:13px;color:#64748b;line-height:1.7;">
        ✉️ ${escapeHtml(merchantEmail)}${merchantPhone ? ` &nbsp;•&nbsp; 📞 ${escapeHtml(merchantPhone)}` : ""}
      </div>
    </td>
  </tr>
  <tr>
    <td style="background-color:#f1f5f9;padding:22px 32px;text-align:center;">
      <div style="font-size:12px;color:#64748b;line-height:1.7;">
        © 2026 ResinCraft — Handmade Resin Art. All rights reserved.<br>
        This message was sent to you regarding your recent order. Please do not share your Order ID publicly.
      </div>
    </td>
  </tr>`;

const wrapEmail = (subject: string, bodyRows: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f6;padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08);border:1px solid #e2e8f0;">
          ${bodyRows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ---------- public templates ----------

export const notifySubject = {
  orderPlaced: (orderId: string) => `Order Confirmation • #${orderId} — ResinCraft`,
  shipped: (orderId: string) => `Your Order Has Been Shipped • #${orderId} — ResinCraft`,
  delivered: (orderId: string) => `Delivery Confirmed • #${orderId} — ResinCraft`,
  cancelled: (orderId: string) => `Order Update: Cancelled • #${orderId} — ResinCraft`,
};

/** Professional HTML email: order confirmed (payment received). NO invoice included. */
export const buildOrderPlacedEmailHTML = (order: NotifyOrder, merchant: { email: string; phone: string }) => {
  const subject = notifySubject.orderPlaced(order.orderId);
  const rows = `
    ${headerBlock("Thank You for Your Order", "Payment received — we are on it!")}
    ${metaRow(order, "Confirmed", "#dcfce7", "#166534")}
    ${greetingBlock(order.customer.fullName, [
      `We have successfully received your payment of <strong style="color:#0f172a;">${inr(order.total)}</strong> and your order has been placed. Each piece is handcrafted with care, so please allow <strong>3–5 business days</strong> for preparation.`,
      `Here is a summary of what you ordered:`,
    ])}
    <tr><td style="padding: 8px 32px 24px;">${itemsTable(order.items, BRAND)}</td></tr>
    <tr><td style="padding: 0 32px 24px;">${totalsBlock(order)}</td></tr>
    ${order.customer.address ? `<tr><td style="padding: 0 32px 24px;"><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;font-weight:700;">Delivery Address</div>${addressBlock(order.customer)}</div></td></tr>` : ""}
    ${greetingBlock("", [
      `<span style="color:#0f172a;font-weight:700;">📄 Tax Invoice:</span> your official invoice will be emailed to you as soon as your order is <strong>shipped</strong>.`,
      `You can track your order status anytime by replying to this email with your Order ID.`,
    ])}
    ${footerBlock(merchant.email, merchant.phone)}
  `;
  return wrapEmail(subject, rows);
};

/** Professional HTML email: shipment notification WITH the official invoice. */
export const buildShipmentEmailHTML = (order: NotifyOrder, merchant: { email: string; phone: string }) => {
  const subject = notifySubject.shipped(order.orderId);
  const trackingUrl = order.awb
    ? `https://www.shiprocket.in/track-consignment/?awb_code=${encodeURIComponent(order.awb)}`
    : "https://wa.me/" + (order.customer.phone || "").replace(/\D/g, "");
  const rows = `
    ${headerBlock("Your Order Has Been Shipped", "Great news — it's on the way!")}
    ${metaRow(order, "Shipped", "#ede9fe", "#6d28d9")}
    ${greetingBlock(order.customer.fullName, [
      `We are delighted to inform you that your handcrafted resin art order <strong style="color:#0f172a;">#${escapeHtml(order.orderId)}</strong> has been carefully packed and dispatched${order.courier ? ` via <strong>${escapeHtml(order.courier)}</strong>` : ""}.`,
    ])}
    ${
      order.awb || order.expectedDelivery
        ? `<tr><td style="padding: 8px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
              <tr><td style="padding:18px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${order.courier ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748b;">Courier Partner</td><td style="padding:5px 0;font-size:14px;color:#0f172a;font-weight:700;text-align:right;">${escapeHtml(order.courier)}</td></tr>` : ""}
                  ${order.awb ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748b;">Tracking / AWB Number</td><td style="padding:5px 0;font-size:14px;color:#0f172a;font-weight:700;text-align:right;font-family:'Courier New',monospace;">${escapeHtml(order.awb)}</td></tr>` : ""}
                  ${order.expectedDelivery ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748b;">Expected Delivery</td><td style="padding:5px 0;font-size:14px;color:#059669;font-weight:700;text-align:right;">${escapeHtml(order.expectedDelivery)}</td></tr>` : ""}
                </table>
              </td></tr>
            </table>
          </td></tr>`
        : ""
    }
    ${buttonBlock(order.awb ? "Track Your Shipment" : "Contact Us", trackingUrl)}
    <tr><td style="padding: 0 32px 10px;"><div style="font-size:18px;font-weight:800;color:#0f172a;">📄 Tax Invoice — ${escapeHtml(order.orderId)}</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:14px;">Invoice No: INV-${escapeHtml(order.orderId.replace(/^RC/, ""))} &nbsp;•&nbsp; Invoice Date: ${escapeHtml(formatDate(new Date().toISOString()))} &nbsp;•&nbsp; Place of Supply: ${escapeHtml(order.customer.state || "India")}</div></td></tr>
    <tr><td style="padding: 0 32px 24px;">${itemsTable(order.items, BRAND_DARK)}</td></tr>
    <tr><td style="padding: 0 32px 24px;">${totalsBlock(order)}</td></tr>
    ${greetingBlock("", [
      `This invoice certifies that payment of <strong style="color:#0f172a;">${inr(order.total)}</strong> has been received in full. Thank you for supporting handmade art — we hope this piece brings warmth and beauty to your space.`,
    ])}
    ${footerBlock(merchant.email, merchant.phone)}
  `;
  return wrapEmail(subject, rows);
};

/** Professional HTML email: delivery confirmation (no invoice re-send). */
export const buildDeliveredEmailHTML = (order: NotifyOrder, merchant: { email: string; phone: string }) => {
  const subject = notifySubject.delivered(order.orderId);
  const rows = `
    ${headerBlock("Successfully Delivered", "We hope you love your new piece!")}
    ${metaRow(order, "Delivered", "#dbeafe", "#1d4ed8")}
    ${greetingBlock(order.customer.fullName, [
      `Our records show that order <strong style="color:#0f172a;">#${escapeHtml(order.orderId)}</strong> has been delivered. We trust your handcrafted piece arrived in perfect condition.`,
      `If anything is amiss, please reach out within 48 hours and we will make it right.`,
    ])}
    ${buttonBlock("Share Feedback via WhatsApp", "https://wa.me/" + (merchant.phone || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(`I'd like to share feedback about my ResinCraft order ${order.orderId}`))}
    ${footerBlock(merchant.email, merchant.phone)}
  `;
  return wrapEmail(subject, rows);
};

/** Professional HTML email: cancellation notice. */
export const buildCancelledEmailHTML = (order: NotifyOrder, merchant: { email: string; phone: string }) => {
  const subject = notifySubject.cancelled(order.orderId);
  const rows = `
    ${headerBlock("Order Cancelled", "We're sorry to see this order go")}
    ${metaRow(order, "Cancelled", "#fee2e2", "#b91c1c")}
    ${greetingBlock(order.customer.fullName, [
      `Your order <strong style="color:#0f172a;">#${escapeHtml(order.orderId)}</strong> has been cancelled. Any amount paid will be refunded to the original payment method within <strong>5–7 business days</strong>.`,
      `If this was unintentional, we would be glad to recreate your order — simply reply to this email or contact us below.`,
    ])}
    ${footerBlock(merchant.email, merchant.phone)}
  `;
  return wrapEmail(subject, rows);
};

// ---------- plain-text fallbacks (email clients without HTML) ----------

const textItems = (items: NotifyOrderItem[]) =>
  items.map((i, idx) => `  ${idx + 1}. ${i.name}  |  Qty: ${i.quantity}  |  ${inr(i.price)} x ${i.quantity} = ${inr(i.price * i.quantity)}`).join("\n");

export const buildOrderPlacedEmailText = (order: NotifyOrder, merchant: { email: string; phone: string }) => {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return `RESINCRAFT — ORDER CONFIRMATION
================================

Dear ${order.customer.fullName},

Thank you! We have received your payment and your order has been placed.

ORDER SUMMARY
-------------
Order ID       : ${order.orderId}
Date           : ${formatDateTime(order.date)}
Payment Method : ${(order.paymentMethod || "—").toUpperCase()}
Status         : CONFIRMED

ITEMS
-----
${textItems(order.items)}

Subtotal : ${inr(subtotal)}
Shipping : ${order.shippingCost === 0 ? "FREE" : inr(order.shippingCost ?? 0)}
GST      : ${inr(order.tax ?? 0)}
TOTAL PAID : ${inr(order.total)}

DELIVERY ADDRESS
----------------
${order.customer.fullName}
${order.customer.address || ""}${order.customer.address ? "\n" : ""}${[order.customer.city, order.customer.state, order.customer.pincode].filter(Boolean).join(", ")}

NOTE: Your tax invoice will be emailed automatically once your order is SHIPPED.

For assistance, contact us:
${merchant.email}${merchant.phone ? ` | ${merchant.phone}` : ""}

© 2026 ResinCraft — Handmade Resin Art`;
};

export const buildShipmentEmailText = (order: NotifyOrder, merchant: { email: string; phone: string }) => {
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return `RESINCRAFT — SHIPPING NOTIFICATION & TAX INVOICE
=====================================================

Dear ${order.customer.fullName},

Great news — your order has been shipped${order.courier ? ` via ${order.courier}` : ""}!

ORDER SUMMARY
-------------
Order ID       : ${order.orderId}
Shipped On     : ${formatDateTime(new Date().toISOString())}${order.awb ? `
Tracking (AWB) : ${order.awb}` : ""}${order.expectedDelivery ? `
Expected ETA   : ${order.expectedDelivery}` : ""}

TAX INVOICE — ${order.orderId}
------------------------------
${textItems(order.items)}

Subtotal : ${inr(subtotal)}
Shipping : ${order.shippingCost === 0 ? "FREE" : inr(order.shippingCost ?? 0)}
GST      : ${inr(order.tax ?? 0)}
-----------------------
TOTAL PAID : ${inr(order.total)}

Payment has been received in full. Thank you for supporting handmade art!

For assistance, contact us:
${merchant.email}${merchant.phone ? ` | ${merchant.phone}` : ""}

© 2026 ResinCraft — Handmade Resin Art`;
};

export const buildDeliveredEmailText = (order: NotifyOrder, merchant: { email: string; phone: string }) =>
  `RESINCRAFT — DELIVERY CONFIRMATION
==================================

Dear ${order.customer.fullName},

Your order #${order.orderId} has been delivered. We hope your handcrafted piece arrived in perfect condition.

If you are satisfied, we would love to hear from you! For any concerns, please contact us within 48 hours.

${merchant.email}${merchant.phone ? ` | ${merchant.phone}` : ""}

© 2026 ResinCraft — Handmade Resin Art`;

export const buildCancelledEmailText = (order: NotifyOrder, merchant: { email: string; phone: string }) =>
  `RESINCRAFT — ORDER CANCELLED
============================

Dear ${order.customer.fullName},

Your order #${order.orderId} has been cancelled. Any amount paid will be refunded within 5–7 business days to the original payment method.

If this was unintentional, we would be glad to help you reorder.

${merchant.email}${merchant.phone ? ` | ${merchant.phone}` : ""}

© 2026 ResinCraft — Handmade Resin Art`;

// ---------- WhatsApp notifications ----------
// WhatsApp supports light markdown (*bold*, _italic_, ~strike~). Messages below are
// structured, spaced and professional. wa.me links must carry URL-encoded text.

const waHeader = (title: string) => `*✦ RESINCRAFT — HANDMADE RESIN ART ✦*\n*${title}*\n━━━━━━━━━━━━━━━━━━━━`;

export const whatsappTemplates = {
  orderPlaced: (o: NotifyOrder) => `${waHeader("🛒 NEW ORDER RECEIVED")}

*Order ID:* ${o.orderId}
*Received:* ${formatDateTime(o.date)}

*CUSTOMER*
• Name: ${o.customer.fullName}
• Phone: ${o.customer.phone}
• Email: ${o.customer.email}

*ITEMS*
${o.items.map((i) => `• ${i.name} × ${i.quantity} — ${inr(i.price * i.quantity)}`).join("\n")}

*Bill Summary*
• Subtotal: ${inr(o.subtotal ?? o.items.reduce((s, i) => s + i.price * i.quantity, 0))}
• Shipping: ${o.shippingCost === 0 ? "FREE" : inr(o.shippingCost ?? 0)}
• GST: ${inr(o.tax ?? 0)}
• *Total Paid: ${inr(o.total)}*

*PAYMENT*
• Method: ${(o.paymentMethod || "—").toUpperCase()}
• Status: ✅ PAID

*DELIVERY ADDRESS*
${o.customer.address || "—"}
${[o.customer.city, o.customer.state, o.customer.pincode].filter(Boolean).join(", ")}

_Payment confirmed — order placed automatically. Invoice will be sent to the customer when the order is marked SHIPPED._`,

  shipped: (o: NotifyOrder) => `${waHeader("📦 ORDER SHIPPED")}

*Hi ${o.customer.fullName},*

Your order *#${o.orderId}* has been shipped${o.courier ? ` via *${o.courier}*` : ""}. 🎉

• Dispatched: ${formatDateTime(new Date().toISOString())}${o.awb ? `\n• Tracking (AWB): *${o.awb}*` : ""}${o.expectedDelivery ? `\n• Expected Delivery: ${o.expectedDelivery}` : ""}

Your official *tax invoice* has been emailed to ${o.customer.email}.

Thank you for supporting handmade art! ✨
_— Team ResinCraft_`,

  delivered: (o: NotifyOrder) => `${waHeader("✅ DELIVERY CONFIRMED")}

*Hi ${o.customer.fullName},*

Your order *#${o.orderId}* has been delivered. We hope your handcrafted piece brings joy to your space! ✨

If you have any feedback or concerns, simply reply to this message.

_— Team ResinCraft_`,

  cancelled: (o: NotifyOrder) => `${waHeader("⚠️ ORDER CANCELLED")}

*Hi ${o.customer.fullName},*

Your order *#${o.orderId}* has been cancelled.

• Refund: Any amount paid will be returned within *5–7 business days* to the original payment method.

If this was unintentional, we would be happy to help you reorder — just reply here.

_— Team ResinCraft_`,
};

export const buildWhatsappLink = (phone: string, message: string) =>
  `https://wa.me/${(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

export { initials };
