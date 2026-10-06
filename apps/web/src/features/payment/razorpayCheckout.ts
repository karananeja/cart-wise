/** Razorpay Checkout's browser script (F-014): loaded only when the Razorpay tab is used. */
export const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: 'INR';
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme?: { color: string };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let loading: Promise<void> | undefined;

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve() : reject(new Error('Razorpay did not load')));
    script.onerror = () => {
      script.remove();
      reject(new Error('Razorpay did not load'));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = undefined; // allow a retry
    throw error;
  });
  return loading;
}
