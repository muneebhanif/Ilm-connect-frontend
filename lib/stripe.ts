import React from 'react';
import { Platform } from 'react-native';

let StripeProvider: any;
let useStripe: any;

if (Platform.OS !== 'web') {
  const stripe = require('@stripe/stripe-react-native');
  StripeProvider = stripe.StripeProvider;
  useStripe = stripe.useStripe;
} else {
  StripeProvider = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  useStripe = () => ({
    initPaymentSheet: async () => ({ error: { message: 'Not available on web' } }),
    presentPaymentSheet: async () => ({ error: { message: 'Not available on web' } }),
  });
}

export { StripeProvider, useStripe };
