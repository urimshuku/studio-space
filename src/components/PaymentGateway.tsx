import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Category } from '../lib/types';
import { PERSON_NAME_INPUT_ATTRS, sanitizePersonNameInput } from '../lib/sanitizePersonName';
import { BackButton } from './BackButton';
import { MarketingOptInCheckbox } from './MarketingOptInCheckbox';
import { loadPaypalSdk, type PaypalCardFields } from '../lib/paypal';

interface PaymentGatewayProps {
  category: Category;
  onBack: () => void;
  onSuccess: () => void;
}

const PRESET_AMOUNTS = [20, 50, 100, 500];
const MAX_WORDS_OF_SUPPORT = 150;

const BANK_TRANSFER_OPTIONS = {
  kosovo: {
    label: 'Kosovo',
    hint: 'For transfers from a Kosovo bank',
    iban: 'XK055200001799019579',
    bic: 'PHHAXKPRXXX',
  },
  international: {
    label: 'International',
    hint: 'For transfers from outside Kosovo',
    iban: 'LT763500010018990295',
    bic: 'EVIULT2VXXX',
  },
} as const;

function formatIban(iban: string): string {
  const compact = iban.replace(/\s+/g, '').toUpperCase();
  if (!compact) return '';
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

/** Basic email validation */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function PaymentGateway({ category, onBack, onSuccess }: PaymentGatewayProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [email, setEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [wordsOfSupport, setWordsOfSupport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [paypalOpen, setPaypalOpen] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalHost, setPaypalHost] = useState<HTMLDivElement | null>(null);
  const [cardButtonHost, setCardButtonHost] = useState<HTMLDivElement | null>(null);
  const [cardEligible, setCardEligible] = useState(false);
  const [hostedCard, setHostedCard] = useState(false);
  const [cardPaying, setCardPaying] = useState(false);
  const cardFieldsRef = useRef<PaypalCardFields | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const [bankRegion, setBankRegion] = useState<'kosovo' | 'international'>('kosovo');

  const amount = (selectedAmount ?? parseFloat(customAmount)) || 0;
  const formValid =
    amount > 0 &&
    (!!donorName || isAnonymous) &&
    !!email.trim() &&
    isValidEmail(email);

  const formDataRef = useRef({
    category_id: category.id,
    donor_name: donorName,
    email: email.trim(),
    amount,
    is_anonymous: isAnonymous,
    words_of_support: wordsOfSupport.trim().slice(0, MAX_WORDS_OF_SUPPORT) || undefined,
    marketingOptIn,
  });
  useEffect(() => {
    formDataRef.current = {
      category_id: category.id,
      donor_name: isAnonymous ? 'Anonymous' : donorName,
      email: email.trim(),
      amount,
      is_anonymous: isAnonymous,
      words_of_support: wordsOfSupport.trim().slice(0, MAX_WORDS_OF_SUPPORT) || undefined,
      marketingOptIn,
    };
  }, [category.id, donorName, email, isAnonymous, wordsOfSupport, amount, marketingOptIn]);

  useEffect(() => {
    if (!paypalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPaypalOpen(false);
        setInfo(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [paypalOpen]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const donationPayload = () => {
    const d = formDataRef.current;
    return {
      category_id: d.category_id,
      donor_name: d.donor_name,
      email: d.email,
      amount: d.amount,
      is_anonymous: d.is_anonymous,
      words_of_support: d.words_of_support,
      marketingOptIn: d.marketingOptIn,
    };
  };

  const validateForm = (): boolean => {
    setError(null);
    setInfo(null);
    if (!formValid) {
      if (amount <= 0) setError('Please make at least one selection.');
      else if (!donorName && !isAnonymous) setError('Please enter your name or check Donate anonymously.');
      else if (!email.trim()) setError('Please enter your email address.');
      else if (!isValidEmail(email)) setError('Please enter a valid email address.');
      return false;
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      setError('Checkout is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return false;
    }
    return true;
  };

  const closePaypalCheckout = () => {
    setPaypalOpen(false);
    setPaypalReady(false);
    setCardEligible(false);
    setHostedCard(false);
    setCardPaying(false);
    cardFieldsRef.current = null;
    setInfo(null);
  };

  const handlePaypalCheckout = () => {
    if (!validateForm()) return;
    setPaypalOpen(true);
    setPaypalReady(false);
    setCardEligible(false);
    setHostedCard(false);
    setCardPaying(false);
  };

  useEffect(() => {
    if (!paypalOpen || !paypalHost || !cardButtonHost || !supabaseUrl || !supabaseAnonKey) return;

    let cancelled = false;
    const buttonInstances: Array<{ close: () => Promise<void> }> = [];
    const functionsBase = `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    };

    const createOrder = async () => {
      const res = await fetch(`${functionsBase}/paypal-create-order`, {
        method: 'POST',
        headers,
        body: JSON.stringify(donationPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.orderId) {
        throw new Error(data?.error || 'Failed to start PayPal checkout');
      }
      return data.orderId as string;
    };

    const onApprove = async (data: { orderID: string }) => {
      const res = await fetch(`${functionsBase}/paypal-capture-order`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: data.orderID }),
      });
      const captured = await res.json();
      if (!res.ok) {
        throw new Error(captured?.error || 'Payment could not be completed');
      }
      closePaypalCheckout();
      onSuccessRef.current();
    };

    (async () => {
      try {
        const configRes = await fetch(`${functionsBase}/paypal-config`, { headers });
        const config = await configRes.json();
        if (!configRes.ok || !config.sdkUrl) {
          throw new Error(config?.error || 'PayPal is not configured');
        }
        await loadPaypalSdk(config.sdkUrl as string, config.clientToken as string | null);
        if (cancelled || !window.paypal) return;

        paypalHost.innerHTML = '';
        if (cardButtonHost) cardButtonHost.innerHTML = '';

        const paypalFunding = window.paypal.FUNDING?.PAYPAL;
        const paypalButtons = window.paypal.Buttons({
          ...(paypalFunding ? { fundingSource: paypalFunding } : {}),
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
          createOrder,
          onApprove,
          onCancel: () => {
            setInfo('Payment was canceled.');
          },
          onError: (err) => {
            console.error(err);
            setCardPaying(false);
            setError('PayPal checkout failed. Please try again.');
          },
        });
        await paypalButtons.render(paypalHost);
        buttonInstances.push(paypalButtons);
        if (cancelled) return;

        let customCard = false;
        if (typeof window.paypal.CardFields === 'function') {
          try {
            const cardFields = window.paypal.CardFields({
              style: {
                input: {
                  'font-size': '16px',
                  'font-family': 'inherit',
                  color: '#111827',
                },
                '.invalid': { color: '#dc2626' },
              },
              createOrder,
              onApprove,
              onCancel: () => {
                setCardPaying(false);
                setInfo('Payment was canceled.');
              },
              onError: (err) => {
                console.error(err);
                setCardPaying(false);
                setError('Card payment failed. Please try again.');
              },
            });
            if (cardFields.isEligible()) {
              cardFieldsRef.current = cardFields;
              customCard = true;
            }
          } catch (err) {
            console.error(err);
          }
        }

        if (!customCard && cardButtonHost && window.paypal.FUNDING?.CARD) {
          const cardButtons = window.paypal.Buttons({
            fundingSource: window.paypal.FUNDING.CARD,
            style: { layout: 'vertical', color: 'black', shape: 'rect', label: 'pay' },
            createOrder,
            onApprove,
            onCancel: () => {
              setInfo('Payment was canceled.');
            },
            onError: (err) => {
              console.error(err);
              setError('Card checkout failed. Please try again.');
            },
          });
          try {
            if (!cardButtons.isEligible || cardButtons.isEligible()) {
              await cardButtons.render(cardButtonHost);
              buttonInstances.push(cardButtons);
              if (!cancelled) setHostedCard(true);
            }
          } catch (err) {
            console.error(err);
          }
        }

        if (!cancelled) {
          setCardEligible(customCard);
          setPaypalReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setPaypalOpen(false);
          setError(err instanceof Error ? err.message : 'PayPal checkout is not available yet.');
        }
      }
    })();

    return () => {
      cancelled = true;
      cardFieldsRef.current = null;
      buttonInstances.forEach((instance) => {
        void instance.close();
      });
    };
  }, [paypalOpen, paypalHost, cardButtonHost, supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    if (!paypalOpen || !cardEligible || !cardFieldsRef.current) return;
    const cardFields = cardFieldsRef.current;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          cardFields.NameField({ placeholder: 'Name on card' }).render('#paypal-card-name'),
          cardFields.NumberField({ placeholder: 'Card number' }).render('#paypal-card-number'),
          cardFields.ExpiryField({ placeholder: 'MM / YY' }).render('#paypal-card-expiry'),
          cardFields.CVVField({ placeholder: 'CVC' }).render('#paypal-card-cvv'),
        ]);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setCardEligible(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paypalOpen, cardEligible]);

  const handleCardPay = async () => {
    if (!cardFieldsRef.current || cardPaying) return;
    setError(null);
    setInfo(null);
    setCardPaying(true);
    try {
      await cardFieldsRef.current.submit({
        billingAddress: { countryCode: 'XK' },
      });
    } catch (err) {
      setCardPaying(false);
      setError(err instanceof Error ? err.message : 'Card payment failed. Please try again.');
    }
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div className="max-w-2xl mx-auto px-1 sm:px-0">
        <BackButton onClick={onBack} className="mb-4 sm:mb-6" />
        <div className="theme-surface rounded-xl shadow-xl p-6 border border-gray-100">
          <p className="text-gray-600 mb-2">Checkout is not configured.</p>
          <p className="text-sm text-gray-600">
            Set <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
            <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in your <code className="bg-gray-100 px-1 rounded">.env</code> file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-2xl mx-auto px-1 sm:px-0">
      <BackButton onClick={onBack} className="mb-4 sm:mb-6" />

      <div className="theme-surface rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-100">
        <div className="mb-5 sm:mb-6 md:mb-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            Support {category.name}
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">{category.description}</p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
              Donation Amount <span className="text-gray-400 font-normal">(*)</span>
            </label>
            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-2 sm:mb-3">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(preset);
                    setCustomAmount('');
                  }}
                  className={`py-3 sm:py-4 px-2 sm:px-4 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                    selectedAmount === preset
                      ? 'text-white shadow-md scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{
                    backgroundColor: selectedAmount === preset ? '#c95b2d' : undefined,
                  }}
                >
                  €{preset}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm sm:text-base">
                €
              </span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedAmount(null);
                }}
                placeholder="Other amount"
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                style={{ '--tw-ring-color': '#c95b2d', fontSize: '16px' } as React.CSSProperties}
                min="1"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
              Full Name
            </label>
            <input
              {...PERSON_NAME_INPUT_ATTRS}
              value={donorName}
              onChange={(e) => setDonorName(sanitizePersonNameInput(e.target.value))}
              disabled={isAnonymous}
              placeholder="Enter your name"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100"
              style={{ fontSize: '16px' }}
            />
            <label className="flex items-center gap-2 mt-1.5 sm:mt-2">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="theme-checkbox-native w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm text-gray-600">Donate anonymously</span>
            </label>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
              Email Address <span className="text-gray-400 font-normal">(*)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              style={{ fontSize: '16px' }}
              autoComplete="email"
            />
            <p className="mt-1 text-xs text-gray-500">Already signed up? Use the same email to update your request.</p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
              Words of Support <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={wordsOfSupport}
              onChange={(e) => setWordsOfSupport(e.target.value.slice(0, MAX_WORDS_OF_SUPPORT))}
              placeholder="Leave a short message in support of the space"
              maxLength={MAX_WORDS_OF_SUPPORT}
              rows={3}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              style={{ fontSize: '16px' }}
            />
            <p className="text-xs text-gray-500 mt-1">
              {wordsOfSupport.length}/{MAX_WORDS_OF_SUPPORT} characters
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 sm:p-4">
            <div className="flex justify-between items-center text-xs sm:text-sm mb-1">
              <span className="text-gray-600">Donation Amount:</span>
              <span className="font-semibold text-gray-900">€{amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base sm:text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-xl sm:text-2xl font-bold" style={{ color: '#c95b2d' }}>
                €{amount.toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-blue-700" role="status">
              {info}
            </p>
          )}

          <div className="w-full">
            <MarketingOptInCheckbox
              id="donation-marketing-opt-in"
              checked={marketingOptIn}
              onChange={setMarketingOptIn}
            />
          </div>

          <button
            type="button"
            onClick={handlePaypalCheckout}
            disabled={amount <= 0}
            className="w-full py-3 sm:py-4 px-4 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#136c9c' }}
          >
            Pay with PayPal or Card
          </button>

          <p className="text-sm text-center text-gray-500">or</p>

          <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">Bank transfer</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3">
              You can also donate by bank transfer. Bank gifts are added to the donors list after we receive them.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(Object.keys(BANK_TRANSFER_OPTIONS) as Array<keyof typeof BANK_TRANSFER_OPTIONS>).map((key) => {
                const option = BANK_TRANSFER_OPTIONS[key];
                const selected = bankRegion === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBankRegion(key)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                      selected ? 'text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{ backgroundColor: selected ? '#c95b2d' : undefined }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mb-3">{BANK_TRANSFER_OPTIONS[bankRegion].hint}</p>
            <dl className="space-y-2 text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-gray-600">Recipient</dt>
                <dd className="font-medium text-gray-900 sm:text-right">
                  United Human Beings Foundation /
                  <br />
                  Fondacioni Qenie Njerëzore të Bashkuara
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-gray-600">IBAN</dt>
                <dd className="font-mono text-gray-900 sm:text-right break-all">
                  {formatIban(BANK_TRANSFER_OPTIONS[bankRegion].iban)}
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-gray-600">SWIFT / BIC</dt>
                <dd className="font-medium text-gray-900 sm:text-right">
                  {BANK_TRANSFER_OPTIONS[bankRegion].bic}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-center text-gray-500 mt-8">
              Please include your name as the payment reference so we can match the donation.
            </p>
          </div>
        </div>
      </div>
    </div>
    {paypalOpen &&
      createPortal(
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close checkout"
            onClick={closePaypalCheckout}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="paypal-checkout-title"
            className="relative z-10 w-full sm:max-w-md max-h-[92vh] overflow-y-auto theme-surface rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
              <div>
                <h3 id="paypal-checkout-title" className="text-base sm:text-lg font-semibold text-gray-900">
                  Pay €{amount.toFixed(2)}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {cardEligible
                    ? 'Pay with PayPal, or enter card details only. We do not ask for a billing address.'
                    : 'Pay with PayPal or with a card. If Kosovo is not in the card country list, use PayPal or bank transfer.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closePaypalCheckout}
                className="shrink-0 p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {!paypalReady && (
                <p className="text-sm text-center text-gray-500 mb-3">Loading PayPal…</p>
              )}
              <div ref={setPaypalHost} />
              <div ref={setCardButtonHost} className={hostedCard ? 'mt-3' : undefined} />
              {cardEligible && (
                <div className="mt-4">
                  <p className="text-sm text-center text-gray-500 mb-3">or pay with card</p>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="paypal-card-name" className="block text-xs font-semibold text-gray-700 mb-1">
                        Name on card
                      </label>
                      <div
                        id="paypal-card-name"
                        className="h-11 w-full border border-gray-300 rounded-lg px-3 flex items-center bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="paypal-card-number" className="block text-xs font-semibold text-gray-700 mb-1">
                        Card number
                      </label>
                      <div
                        id="paypal-card-number"
                        className="h-11 w-full border border-gray-300 rounded-lg px-3 flex items-center bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="paypal-card-expiry" className="block text-xs font-semibold text-gray-700 mb-1">
                          Expiry
                        </label>
                        <div
                          id="paypal-card-expiry"
                          className="h-11 w-full border border-gray-300 rounded-lg px-3 flex items-center bg-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="paypal-card-cvv" className="block text-xs font-semibold text-gray-700 mb-1">
                          CVC
                        </label>
                        <div
                          id="paypal-card-cvv"
                          className="h-11 w-full border border-gray-300 rounded-lg px-3 flex items-center bg-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCardPay()}
                      disabled={cardPaying}
                      className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: '#136c9c' }}
                    >
                      {cardPaying ? 'Processing…' : `Pay €${amount.toFixed(2)}`}
                    </button>
                  </div>
                </div>
              )}
              {paypalReady && !cardEligible && !hostedCard && (
                <p className="text-xs text-center text-gray-500 mt-3">
                  PayPal is not offering card for this checkout. Use PayPal, or bank transfer below.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
