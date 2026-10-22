// Email Template Generator for Order Confirmation & Invoice
export const generateOrderEmailHTML = (order: any) => {
  const orderDate = new Date(order.date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const itemsHTML = order.items.map((item: any, index: number) => `
    <tr style="background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding: 16px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">${index + 1}</td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${item.name}</div>
        <div style="font-size: 13px; color: #6b7280;">Handmade Resin Art</div>
      </td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #374151;">${item.quantity}</td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151;">₹${item.price.toLocaleString('en-IN')}</td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #111827;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const shipping = order.shippingCost || 0;
  const tax = order.tax || 0;
  const total = order.total || (subtotal + shipping + tax);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - ResinCraft</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 1px; margin-bottom: 8px;">
                ✨ ResinCraft
              </div>
              <div style="font-size: 14px; color: #e0e7ff; letter-spacing: 0.5px;">
                Handmade Resin Art
              </div>
            </td>
          </tr>

          <!-- Success Message -->
          <tr>
            <td style="padding: 40px 30px 20px 30px; text-align: center;">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; color: #ffffff;">✓</span>
              </div>
              <h1 style="margin: 0 0 12px 0; font-size: 28px; color: #111827; font-weight: 700;">
                Order Confirmed!
              </h1>
              <p style="margin: 0; font-size: 16px; color: #6b7280; line-height: 1.6;">
                Thank you for your order! We've received your payment and will begin crafting your beautiful resin art piece.
              </p>
            </td>
          </tr>

          <!-- Order Details Card -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 50%; padding: 8px 0;">
                          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Order ID</div>
                          <div style="font-size: 16px; color: #111827; font-weight: 600;">${order.orderId}</div>
                        </td>
                        <td style="width: 50%; padding: 8px 0; text-align: right;">
                          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Order Date</div>
                          <div style="font-size: 16px; color: #111827; font-weight: 600;">${orderDate}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; padding: 8px 0;">
                          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Payment Method</div>
                          <div style="font-size: 16px; color: #111827; font-weight: 600; text-transform: capitalize;">${order.payment.method}</div>
                        </td>
                        <td style="width: 50%; padding: 8px 0; text-align: right;">
                          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Status</div>
                          <div style="display: inline-block; padding: 4px 12px; background-color: #d1fae5; color: #065f46; border-radius: 12px; font-size: 13px; font-weight: 600;">
                            Confirmed
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice Table -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #111827; font-weight: 700;">
                📋 Invoice Details
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #667eea;">
                    <th style="padding: 14px 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">#</th>
                    <th style="padding: 14px 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Product</th>
                    <th style="padding: 14px 12px; text-align: center; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                    <th style="padding: 14px 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Price</th>
                    <th style="padding: 14px 12px; text-align: right; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Order Summary -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 15px;">Subtotal</td>
                        <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 15px; font-weight: 600;">₹${subtotal.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 15px;">Shipping</td>
                        <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 15px; font-weight: 600;">
                          ${shipping === 0 ? '<span style="color: #10b981;">FREE</span>' : `₹${shipping.toLocaleString('en-IN')}`}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 15px;">GST (18%)</td>
                        <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 15px; font-weight: 600;">₹${tax.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 16px 0 0 0; border-top: 2px solid #e5e7eb;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 8px 0; color: #111827; font-size: 18px; font-weight: 700;">Total Amount</td>
                              <td style="padding: 8px 0; text-align: right; color: #667eea; font-size: 24px; font-weight: 700;">₹${total.toLocaleString('en-IN')}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Address -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827; font-weight: 700;">
                📦 Shipping Address
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="margin-bottom: 12px;">
                      <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Customer Name</div>
                      <div style="font-size: 16px; color: #111827; font-weight: 600;">${order.shipping.fullName}</div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Address</div>
                      <div style="font-size: 15px; color: #374151; line-height: 1.6;">
                        ${order.shipping.address}<br>
                        ${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}<br>
                        ${order.shipping.country}
                      </div>
                    </div>
                    <div>
                      <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Contact</div>
                      <div style="font-size: 15px; color: #374151;">
                        📞 ${order.shipping.phone}<br>
                        ✉️ ${order.shipping.email}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What's Next -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827; font-weight: 700;">
                ✨ What's Next?
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 32px; color: #1e40af; font-weight: 700;">1</div>
                        </td>
                        <td style="vertical-align: top;">
                          <div style="font-size: 15px; color: #111827; font-weight: 600; margin-bottom: 4px;">Order Processing</div>
                          <div style="font-size: 14px; color: #6b7280;">We're preparing your handmade resin art with care</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 32px; color: #1e40af; font-weight: 700;">2</div>
                        </td>
                        <td style="vertical-align: top;">
                          <div style="font-size: 15px; color: #111827; font-weight: 600; margin-bottom: 4px;">Quality Check</div>
                          <div style="font-size: 14px; color: #6b7280;">Each piece is inspected to ensure perfection</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 32px; color: #1e40af; font-weight: 700;">3</div>
                        </td>
                        <td style="vertical-align: top;">
                          <div style="font-size: 15px; color: #111827; font-weight: 600; margin-bottom: 4px;">Shipping</div>
                          <div style="font-size: 14px; color: #6b7280;">Your order will be shipped within 3-5 business days</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact Info -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <div style="font-size: 16px; color: #ffffff; font-weight: 600; margin-bottom: 8px;">
                      Need Help?
                    </div>
                    <div style="font-size: 14px; color: #e0e7ff; margin-bottom: 16px;">
                      Contact us for any questions about your order
                    </div>
                    <div style="font-size: 14px; color: #ffffff;">
                      📧 support@resincraft.in<br>
                      📞 +91 98765 43210
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">
                Thank you for supporting handmade art! ✨
              </div>
              <div style="font-size: 13px; color: #9ca3af;">
                © 2026 ResinCraft. All rights reserved.<br>
                Each piece is uniquely handcrafted with love.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Plain text version for email clients that don't support HTML
export const generateOrderEmailText = (order: any) => {
  const orderDate = new Date(order.date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const itemsList = order.items.map((item: any, index: number) => 
    `${index + 1}. ${item.name} x ${item.quantity} = ₹${(item.price * item.quantity).toLocaleString('en-IN')}`
  ).join('\n');

  const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const shipping = order.shippingCost || 0;
  const tax = order.tax || 0;
  const total = order.total || (subtotal + shipping + tax);

  return `
✨ ORDER CONFIRMED - ResinCraft ✨

Thank you for your order! We've received your payment and will begin crafting your beautiful resin art piece.

ORDER DETAILS
=============
Order ID: ${order.orderId}
Order Date: ${orderDate}
Payment Method: ${order.payment.method}
Status: Confirmed

INVOICE DETAILS
===============
${itemsList}

Subtotal: ₹${subtotal.toLocaleString('en-IN')}
Shipping: ${shipping === 0 ? 'FREE' : `₹${shipping.toLocaleString('en-IN')}`}
GST (18%): ₹${tax.toLocaleString('en-IN')}
-------------------
TOTAL: ₹${total.toLocaleString('en-IN')}

SHIPPING ADDRESS
================
${order.shipping.fullName}
${order.shipping.address}
${order.shipping.city}, ${order.shipping.state} - ${order.shipping.pincode}
${order.shipping.country}

Phone: ${order.shipping.phone}
Email: ${order.shipping.email}

WHAT'S NEXT?
============
1. Order Processing - We're preparing your handmade resin art with care
2. Quality Check - Each piece is inspected to ensure perfection
3. Shipping - Your order will be shipped within 3-5 business days

NEED HELP?
==========
📧 support@resincraft.in
📞 +91 98765 43210

Thank you for supporting handmade art! ✨

© 2026 ResinCraft. All rights reserved.
Each piece is uniquely handcrafted with love.
  `.trim();
};
