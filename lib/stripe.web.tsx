// Web stub: @stripe/stripe-react-native is a native-only SDK.
// These no-op shims prevent Metro from crashing when bundling for web.
// Payments are intentionally not available on the web build.
import React from 'react';

export function StripeProvider({ children }: { children: React.ReactNode; [key: string]: any }) {
  return <>{children}</>;
}

export function useStripe() {
  const notAvailable = async () => {
    console.warn('[Stripe] Payment features are only available on iOS/Android.');
    return { error: { code: 'NotAvailable', message: 'Payments are not available on web.' } };
  };
  return {
    initPaymentSheet: notAvailable,
    presentPaymentSheet: notAvailable,
    confirmPaymentSheetPayment: notAvailable,
  };
}
