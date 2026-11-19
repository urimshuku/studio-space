import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Category } from '../lib/types';

interface AdminPageProps {
  onHome: () => void;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface RecentDonation {
  id: string;
  donor_name: string;
  amount: number;
  is_anonymous: boolean;
  created_at: string;
  category_id: string;
}

const MAX_WORDS = 150;

const HIDDEN_CATEGORY_NAMES = new Set([
  'Workshop Tables',
  'Insulation',
  'Garden',
  'Kitchen',
  'Essentials',
  'A/C',
]);

function todayInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function functionsBase(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1`;
}

export function AdminPage({ onHome }: AdminPageProps) {
  const [ready, setReady] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [email, setEmail] = useState('');
  const [words, setWords] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayInputValue);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<RecentDonation[]>([]);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSessionToken(data.session?.access_token ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionToken(session?.access_token ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !sessionToken) return;
    const client = supabase;
    void (async () => {
      const { data } = await client
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      const visible = ((data ?? []) as Category[]).filter(
        (row) => !row.archived && !HIDDEN_CATEGORY_NAMES.has(row.name),
      );
      const hasRenovations = visible.some((row) => row.name === 'Renovations');
      const options = visible
        .filter((row) => row.name !== 'General Donations' || !hasRenovations)
        .map((row) => ({
          id: row.id,
          name: row.name === 'General Donations' ? 'Renovations' : row.name,
        }));
      setCategories(options);
      setCategoryId((current) => {
        if (current && options.some((option) => option.id === current)) return current;
        const renovations = options.find((option) => option.name === 'Renovations');
        return renovations?.id ?? options[0]?.id ?? '';
      });
    })();
  }, [sessionToken]);

  const loadRecent = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('donations')
      .select('id, donor_name, amount, is_anonymous, created_at, category_id')
      .order('created_at', { ascending: false })
      .limit(12);
    setRecent((data ?? []) as RecentDonation[]);
  };

  useEffect(() => {
    if (sessionToken) void loadRecent();
  }, [sessionToken]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    if (!supabase) {
      setLoginError('Supabase is not configured.');
      return;
    }
    const base = functionsBase();
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!base || !anon) {
      setLoginError('Supabase is not configured.');
      return;
    }
    setSigningIn(true);
    try {
      const res = await fetch(`${base}/admin-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anon}`,
          apikey: anon,
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json()) as {
        error?: string;
        access_token?: string;
        refresh_token?: string;
      };
      if (!res.ok || !data.access_token || !data.refresh_token) {
        setLoginError(data.error || 'Invalid username or password.');
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) {
        setLoginError(error.message);
        return;
      }
      setPassword('');
    } catch {
      setLoginError('Could not sign in.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setSessionToken(null);
    setSaveMessage(null);
    setSaveError(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    setSaveMessage(null);
    if (!supabase || !sessionToken) return;
    const base = functionsBase();
    if (!base) {
      setSaveError('Supabase is not configured.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!categoryId) {
      setSaveError('Renovations is not available yet.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSaveError('Enter an amount greater than zero.');
      return;
    }
    if (!isAnonymous && !donorName.trim()) {
      setSaveError('Enter the donor name, or mark the gift as anonymous.');
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? sessionToken;
      const res = await fetch(`${base}/admin-record-donation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category_id: categoryId,
          donor_name: isAnonymous ? 'Anonymous' : donorName.trim(),
          amount: parsedAmount,
          is_anonymous: isAnonymous,
          email: email.trim() || undefined,
          words_of_support: words.trim() || undefined,
          created_at: `${receivedOn}T12:00:00.000Z`,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSaveError(data.error || 'Could not save the donation.');
        return;
      }
      setAmount('');
      setDonorName('');
      setEmail('');
      setWords('');
      setIsAnonymous(false);
      setSaveMessage('Donation recorded.');
      await loadRecent();
    } catch {
      setSaveError('Could not save the donation.');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen theme-page flex items-center justify-center">
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(201, 91, 45, 0.2)', borderTopColor: '#c95b2d' }}
          aria-hidden
        />
      </div>
    );
  }

  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? 'Donation';

  return (
    <div className="min-h-screen theme-page px-4 py-10">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Donation hub</h1>
          <button type="button" onClick={onHome} className="text-sm font-semibold text-gray-600 hover:text-gray-900">
            Home
          </button>
        </div>

        {!sessionToken ? (
          <form onSubmit={(event) => void handleLogin(event)} className="theme-surface rounded-xl shadow-xl p-6 border border-gray-100 space-y-4">
            <p className="text-sm text-gray-600">Sign in to record a bank transfer.</p>
            <div>
              <label htmlFor="admin-username" className="block text-sm font-semibold text-gray-700 mb-1">
                Username
              </label>
              <input
                id="admin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-semibold text-gray-700 mb-1">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                style={{ fontSize: '16px' }}
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600" role="alert">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={signingIn || !username.trim() || !password}
              className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#c95b2d' }}
            >
              {signingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <form onSubmit={(event) => void handleSave(event)} className="theme-surface rounded-xl shadow-xl p-6 border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Record a donation</h2>
                <button type="button" onClick={() => void handleLogout()} className="text-sm font-semibold text-gray-600 hover:text-gray-900">
                  Log out
                </button>
              </div>
              <div>
                <p className="block text-sm font-semibold text-gray-700 mb-1">Category</p>
                <p
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                  style={{ fontSize: '16px' }}
                >
                  Renovations
                </p>
              </div>
              <div>
                <label htmlFor="admin-amount" className="block text-sm font-semibold text-gray-700 mb-1">
                  Amount (EUR)
                </label>
                <input
                  id="admin-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div>
                <label htmlFor="admin-donor" className="block text-sm font-semibold text-gray-700 mb-1">
                  Donor name
                </label>
                <input
                  id="admin-donor"
                  value={donorName}
                  onChange={(event) => setDonorName(event.target.value)}
                  disabled={isAnonymous}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  style={{ fontSize: '16px' }}
                />
                <label className="flex items-center gap-2 mt-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(event) => setIsAnonymous(event.target.checked)}
                  />
                  Anonymous
                </label>
              </div>
              <div>
                <label htmlFor="admin-email" className="block text-sm font-semibold text-gray-700 mb-1">
                  Email <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div>
                <label htmlFor="admin-words" className="block text-sm font-semibold text-gray-700 mb-1">
                  Words of support <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="admin-words"
                  value={words}
                  maxLength={MAX_WORDS}
                  rows={3}
                  onChange={(event) => setWords(event.target.value.slice(0, MAX_WORDS))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg resize-none"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {words.length}/{MAX_WORDS}
                </p>
              </div>
              <div>
                <label htmlFor="admin-date" className="block text-sm font-semibold text-gray-700 mb-1">
                  Date received
                </label>
                <input
                  id="admin-date"
                  type="date"
                  value={receivedOn}
                  onChange={(event) => setReceivedOn(event.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                  style={{ fontSize: '16px' }}
                />
              </div>
              {saveError && (
                <p className="text-sm text-red-600" role="alert">
                  {saveError}
                </p>
              )}
              {saveMessage && (
                <p className="text-sm text-green-700" role="status">
                  {saveMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#136c9c' }}
              >
                {saving ? 'Saving…' : 'Save donation'}
              </button>
            </form>

            <div className="theme-surface rounded-xl shadow-xl p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent donations</h2>
              {recent.length === 0 ? (
                <p className="text-sm text-gray-600">No donations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((gift) => (
                    <li key={gift.id} className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-800">
                        {gift.is_anonymous ? 'Anonymous' : gift.donor_name}
                        <span className="text-gray-500"> · {categoryName(gift.category_id)}</span>
                      </span>
                      <span className="font-semibold text-gray-900 whitespace-nowrap">
                        €{Number(gift.amount).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
