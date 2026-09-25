import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ScrollReveal } from './ScrollReveal';
import type { Donation } from '../lib/types';

type ViewMode = 'chronological' | 'top';

/** Format a date as relative time (e.g. "2 hours ago", "1 month ago"). Updates as time passes when component re-renders. */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffMo = Math.floor(diffD / 30);
  const diffY = Math.floor(diffD / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  if (diffH < 24) return `${diffH} ${diffH === 1 ? 'hour' : 'hours'} ago`;
  if (diffD < 7) return `${diffD} ${diffD === 1 ? 'day' : 'days'} ago`;
  if (diffW < 4) return `${diffW} ${diffW === 1 ? 'week' : 'weeks'} ago`;
  if (diffMo < 12) return `${diffMo} ${diffMo === 1 ? 'month' : 'months'} ago`;
  return `${diffY} ${diffY === 1 ? 'year' : 'years'} ago`;
}

const ONE_MONTH_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

const FALLBACK_DONATIONS: Donation[] = [
  {
    id: 'fallback-ardian-batusha',
    category_id: '',
    donor_name: 'Ardian Batusha',
    amount: 800,
    is_anonymous: false,
    created_at: ONE_MONTH_AGO,
  },
  {
    id: 'fallback-xhevat-kastrati',
    category_id: '',
    donor_name: 'Xhevat Kastrati',
    amount: 100,
    is_anonymous: false,
    created_at: ONE_MONTH_AGO,
  },
  {
    id: 'fallback-elona-edonisi',
    category_id: '',
    donor_name: 'Elona dhe Edonisi',
    amount: 100,
    is_anonymous: false,
    created_at: ONE_MONTH_AGO,
  },
  {
    id: 'fallback-1',
    category_id: '',
    donor_name: 'Anonymous',
    amount: 500,
    is_anonymous: true,
    created_at: ONE_MONTH_AGO,
  },
];

export function AllDonors() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('chronological');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    fetchAllDonations();

    const channel = supabase
      .channel('donations-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'donations' },
        () => fetchAllDonations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchAllDonations() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('id, category_id, donor_name, amount, is_anonymous, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonations((data as Donation[]) ?? []);
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      setLoading(false);
    }
  }

  const sortedDonations =
    viewMode === 'top'
      ? [...donations].sort((a, b) => b.amount - a.amount)
      : donations;

  const donationsToShow = sortedDonations.length > 0 ? sortedDonations : FALLBACK_DONATIONS;

  if (loading) {
    return (
      <div className="theme-surface rounded-2xl shadow-md p-8 border border-gray-100">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <section id="donations" aria-labelledby="donations-heading" className="pt-6 sm:pt-8 md:pt-10">
      <div
        className="w-8 sm:w-10 h-1 rounded-full"
        style={{ backgroundColor: '#c95b2d' }}
        aria-hidden
      />
      <ScrollReveal fadeOnly>
        <h2 id="donations-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 mt-4 sm:mt-6 md:mt-8">
          Contributors
        </h2>
      </ScrollReveal>
      <div className="theme-surface rounded-xl sm:rounded-2xl shadow-md p-4 sm:p-6 md:p-8 border border-gray-100 transition-shadow duration-200 ease-out hover:shadow-xl">
        <ScrollReveal>
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <span
              className={`text-sm font-medium transition-colors ${
                viewMode === 'chronological' ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              By date
            </span>
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'chronological' ? 'top' : 'chronological'))}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#c95b2d] focus:ring-offset-2 focus:ring-offset-[var(--color-page)]"
              style={{
                backgroundColor: viewMode === 'top' ? '#c95b2d' : '#d1d5db',
              }}
              role="switch"
              aria-checked={viewMode === 'top'}
              aria-label="Toggle between recent donations and by amount"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  viewMode === 'top' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium transition-colors ${
                viewMode === 'top' ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              By amount
            </span>
          </div>
          {donationsToShow.length === 0 ? (
            <p className="text-gray-500 text-sm sm:text-base">No donations yet. Be the first to donate!</p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {donationsToShow.map((donation, index) => (
                <div
                  key={donation.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-100"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span
                      className="font-medium w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-white text-xs sm:text-sm flex-shrink-0"
                      style={{ backgroundColor: '#c95b2d' }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 text-sm sm:text-base">
                        {donation.is_anonymous ? 'Anonymous' : donation.donor_name}
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        {formatRelativeTime(donation.created_at)}
                      </span>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm sm:text-base">
                    €{donation.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
