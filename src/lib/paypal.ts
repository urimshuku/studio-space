type PaypalBillingAddress = {
  addressLine1?: string;
  addressLine2?: string;
  adminArea1?: string;
  adminArea2?: string;
  countryCode?: string;
  postalCode?: string;
};

type PaypalCardField = {
  render: (target: string | HTMLElement) => Promise<void>;
};

export type PaypalCardFields = {
  isEligible: () => boolean;
  NameField: (options?: { placeholder?: string }) => PaypalCardField;
  NumberField: (options?: { placeholder?: string }) => PaypalCardField;
  ExpiryField: (options?: { placeholder?: string }) => PaypalCardField;
  CVVField: (options?: { placeholder?: string }) => PaypalCardField;
  submit: (options?: { billingAddress?: PaypalBillingAddress }) => Promise<void>;
};

declare global {
  interface Window {
    paypal?: {
      FUNDING?: { PAYPAL?: string; CARD?: string };
      Buttons: (options: {
        fundingSource?: string;
        style?: Record<string, string>;
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onCancel?: () => void;
        onError?: (err: unknown) => void;
      }) => {
        isEligible?: () => boolean;
        render: (target: HTMLElement) => Promise<void>;
        close: () => Promise<void>;
      };
      CardFields?: (options: {
        style?: Record<string, unknown>;
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onCancel?: () => void;
        onError?: (err: unknown) => void;
      }) => PaypalCardFields;
    };
  }
}

const loadedSdkKeys = new Set<string>();

export function loadPaypalSdk(sdkUrl: string, clientToken?: string | null): Promise<void> {
  const cacheKey = `${sdkUrl}::${clientToken ?? ''}`;
  if (window.paypal?.CardFields && loadedSdkKeys.has(cacheKey)) {
    return Promise.resolve();
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${sdkUrl}"]`);
  if (existing && window.paypal?.CardFields) {
    loadedSdkKeys.add(cacheKey);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = sdkUrl;
    script.async = true;
    if (clientToken) {
      script.setAttribute('data-client-token', clientToken);
    }
    script.onload = () => {
      loadedSdkKeys.add(cacheKey);
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load PayPal'));
    document.body.appendChild(script);
  });
}
