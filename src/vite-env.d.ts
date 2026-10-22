/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID: string;
  readonly VITE_RAZORPAY_KEY_SECRET: string;
  readonly VITE_MERCHANT_NAME: string;
  readonly VITE_MERCHANT_EMAIL: string;
  readonly VITE_MERCHANT_PHONE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
