import { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { Header } from './components/Header';
import { BackButton } from './components/BackButton';
import { PaymentGateway } from './components/PaymentGateway';
import { SuccessPage } from './components/SuccessPage';
import { CancelPage } from './components/CancelPage';
import { EntryChoice } from './components/EntryChoice';
import { EntryDotsCanvas } from './components/EntryDotsCanvas';
import { ActivitiesPage } from './components/ActivitiesPage';
import { BookingPage } from './components/BookingPage';
import { VenuePage } from './components/VenuePage';
import { JoinPage } from './components/JoinPage';
import { UnsubscribePage } from './components/UnsubscribePage';
import { EmailPreferencesPage } from './components/EmailPreferencesPage';
import { AllDonors } from './components/AllDonors';
import { WordsOfSupport } from './components/WordsOfSupport';
import { ImageCarousel } from './components/ImageCarousel';
import { ScrollReveal } from './components/ScrollReveal';
import { Footer } from './components/Footer';
import { LegalPage } from './components/LegalPage';
import { supabase } from './lib/supabase';
import { buildAppPath, getBaseFull, pathRelativeToBase } from './lib/routes';
import type { Category } from './lib/types';

type Page =
  | 'entry'
  | 'home'
  | 'payment'
  | 'success'
  | 'cancel'
  | 'activities'
  | 'booking'
  | 'venue'
  | 'join'
  | 'unsubscribe'
  | 'email-preferences'
  | 'privacy-policy'
  | 'cookie-policy'
  | 'terms-of-service';

// Old cause categories that are archived and must never be shown,
// even if the database has not been migrated yet.
const ARCHIVED_CATEGORY_NAMES = new Set([
  'Workshop Tables',
  'Insulation',
  'Garden',
  'Kitchen',
  'Essentials',
  'A/C',
]);

const RENOVATIONS_TARGET = 14300;

// Default categories when Supabase returns none (used on first load or if DB is empty)
const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'default-renovations',
    name: 'Renovations',
    description:
      'Structural renovations to keep Studio Space open: repairing the roof, replacing windows, insulating the walls, restoring the unused 8 m² area, and rebuilding the bathroom.',
    target_amount: RENOVATIONS_TARGET,
    current_amount: 1500,
    sort_order: 0,
    has_progress_bar: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function getPageFromPathname(): Page {
  if (typeof window === 'undefined') return 'entry';
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  const baseFull = getBaseFull();
  const pathRel = pathRelativeToBase(pathname, baseFull);
  const segments = pathRel.split('/').filter(Boolean);
  const isBase =
    pathname === baseFull ||
    pathname === baseFull + '/' ||
    (baseFull === '/' && pathname === '/');
  const isSuccessPath = pathname.endsWith('success') || pathname.includes('/success');
  if (isSuccessPath && params.get('paysera')) return 'success';
  if (pathname.endsWith('cancel') || pathname.includes('/cancel')) return 'cancel';

  if (segments[0] === 'unsubscribe' || pathRel.includes('/unsubscribe')) return 'unsubscribe';
  if (segments[0] === 'email-preferences' || pathRel.includes('/email-preferences')) {
    return 'email-preferences';
  }
  if (segments[0] === 'privacy-policy') return 'privacy-policy';
  if (segments[0] === 'cookie-policy') return 'cookie-policy';
  if (segments[0] === 'terms-of-service') return 'terms-of-service';

  if (
    (segments[0] === 'venue' && segments[1] === 'book') ||
    segments[0] === 'book' ||
    pathRel.includes('/book')
  )
    return 'booking';
  if (
    (segments[0] === 'activities' && segments[1] === 'join') ||
    segments[0] === 'join' ||
    pathRel.includes('/join')
  )
    return 'join';

  if (pathRel.includes('studio-space-activities') || segments[0] === 'activities') return 'activities';
  if (pathRel.includes('studio-space-venue') || segments[0] === 'venue') return 'venue';

  if (
    (segments[0] === 'donations' && (segments.length === 1 || segments[1] === 'donate')) ||
    segments[0] === 'donate' ||
    pathRel === '/donations' ||
    pathRel.startsWith('/donations/')
  )
    return 'home';
  if (isBase && params.get('donate')) return 'home';
  if (isBase) return 'entry';
  return 'home';
}

function getInitialPage(): Page {
  return getPageFromPathname();
}

/** Static pages don’t need the donation-category fetch before rendering. */
function skipInitialLoadingForStaticPages(): boolean {
  if (typeof window === 'undefined') return false;
  const p = getPageFromPathname();
  return (
    p === 'unsubscribe' ||
    p === 'email-preferences' ||
    p === 'privacy-policy' ||
    p === 'cookie-policy' ||
    p === 'terms-of-service'
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage);
  const [selectedTab, setSelectedTab] = useState('Renovations');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(() => !skipInitialLoadingForStaticPages());

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    fetchCategories();

    const channel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
        },
        () => {
          fetchCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (currentPage === 'payment') {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [currentPage]);

  // Sync page with browser back/forward
  useEffect(() => {
    const onPopState = () => setCurrentPage(getPageFromPathname());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const baseFull = getBaseFull();
  const venuePath = buildAppPath('/venue');
  const bookPath = `${venuePath}/book`;
  const activitiesPath = buildAppPath('/activities');
  const joinPath = `${activitiesPath}/join`;
  /** Main “Support Our Studio Space Renovations” listing. */
  const donationsPath = buildAppPath('/donations');
  /** Quick general-donation flow (header “Donate now”). */
  const donatePath = `${donationsPath}/donate`;

  const handleBookNow = () => {
    window.history.pushState({}, '', bookPath);
    setCurrentPage('booking');
    window.scrollTo(0, 0);
  };

  const handleChooseDonations = () => {
    window.history.pushState({}, '', donationsPath);
    setCurrentPage('home');
    window.scrollTo(0, 0);
  };

  const handleChooseActivities = () => {
    window.history.pushState({}, '', activitiesPath);
    setCurrentPage('activities');
    window.scrollTo(0, 0);
  };

  const handleChooseVenue = () => {
    window.history.pushState({}, '', venuePath);
    setCurrentPage('venue');
    window.scrollTo(0, 0);
  };

  const handleBackToEntry = () => {
    window.history.pushState({}, '', baseFull || '/');
    setCurrentPage('entry');
    window.scrollTo(0, 0);
  };

  const handleBackToVenue = () => {
    window.history.pushState({}, '', venuePath);
    setCurrentPage('venue');
    window.scrollTo(0, 0);
  };

  const handleGoToJoin = () => {
    window.history.pushState({}, '', joinPath);
    setCurrentPage('join');
    window.scrollTo(0, 0);
  };

  const handleBackToActivities = () => {
    window.history.pushState({}, '', activitiesPath);
    setCurrentPage('activities');
    window.scrollTo(0, 0);
  };

  // Open payment for a category when visiting a shared link (?donate=categoryId)
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('donate');
    if (!categoryId) return;
    const category =
      categories.find((c) => c.id === categoryId) ??
      DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
    if (category) {
      setSelectedCategory(category);
      setCurrentPage('payment');
      window.history.replaceState({}, '', donatePath);
    }
  }, [loading, categories, donatePath, donationsPath]);

  async function fetchCategories() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    setCurrentPage('home');
    setSelectedCategory(null);

    const targetCategory = displayCategories.find((c) => c.name === tab);
    if (targetCategory) {
      const element = document.getElementById(`category-${targetCategory.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleDonate = (category: Category) => {
    setSelectedCategory(category);
    setCurrentPage('payment');
    window.scrollTo(0, 0);
  };

  const getShareUrl = (category: Category) => {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}${donationsPath}?donate=${encodeURIComponent(category.id)}`;
  };

  const handleShare = async (e: React.MouseEvent, category: Category) => {
    e.preventDefault();
    const url = getShareUrl(category);
    const title = `Donate to ${category.name} - Studio Space`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          alert('Link copied to clipboard');
        } catch {
          alert(url);
        }
      }
    }
  };

  const handlePaymentSuccess = () => {
    window.history.pushState({}, '', buildAppPath('/success?paysera=1'));
    setCurrentPage('success');
  };

  const handleBackHome = () => {
    setCurrentPage('home');
    setSelectedCategory(null);
  };

  // Hide archived categories, and map the legacy "General Donations" name to "Renovations"
  // in case the database migration hasn't been applied yet.
  const visibleDbCategories = categories
    .filter((c) => !c.archived && !ARCHIVED_CATEGORY_NAMES.has(c.name))
    .map((c) =>
      c.name === 'General Donations'
        ? { ...c, name: 'Renovations', target_amount: RENOVATIONS_TARGET, has_progress_bar: true }
        : c
    );
  // Use DB categories when present, but always merge in any default category that's missing
  const rawCategories =
    visibleDbCategories.length > 0
      ? (() => {
          const byName = new Map(visibleDbCategories.map((c) => [c.name, c]));
          for (const def of DEFAULT_CATEGORIES) {
            if (!byName.has(def.name)) byName.set(def.name, def);
          }
          return Array.from(byName.values());
        })()
      : DEFAULT_CATEGORIES;
  // Remove duplicate names – keep first
  const seenNames = new Set<string>();
  const displayCategories = rawCategories
    .filter((c) => {
      if (seenNames.has(c.name)) return false;
      seenNames.add(c.name);
      return true;
    })
    .sort((a, b) => {
      if (a.name === 'Renovations') return -1;
      if (b.name === 'Renovations') return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  const generalCategory = displayCategories.find((c) => c.name === 'Renovations');
  const specificCategories = displayCategories.filter((c) => c.name !== 'Renovations');

  const handleDonateNow = () => {
    if (!generalCategory) return;
    window.history.pushState({}, '', donatePath);
    handleDonate(generalCategory);
  };

  if (loading) {
    return (
      <div className="min-h-screen theme-page flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
              style={{ borderColor: 'rgba(201, 91, 45, 0.2)', borderTopColor: '#c95b2d' }}
            />
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (currentPage === 'unsubscribe') {
    return <UnsubscribePage onHome={handleBackToEntry} />;
  }

  if (currentPage === 'email-preferences') {
    return <EmailPreferencesPage onHome={handleBackToEntry} />;
  }

  if (
    currentPage === 'privacy-policy' ||
    currentPage === 'cookie-policy' ||
    currentPage === 'terms-of-service'
  ) {
    return <LegalPage page={currentPage} onHome={handleBackToEntry} />;
  }

  if (currentPage === 'activities') {
    return (
      <ActivitiesPage
        onBackToEntry={handleBackToEntry}
        onJoinNow={handleGoToJoin}
      />
    );
  }

  if (currentPage === 'join') {
    return <JoinPage onBackToActivities={handleBackToActivities} onLogoHome={handleBackToEntry} />;
  }

  if (currentPage === 'venue') {
    return <VenuePage onBackToEntry={handleBackToEntry} onBookNow={handleBookNow} />;
  }

  if (currentPage === 'booking') {
    return (
      <BookingPage onBackToEntry={handleBackToVenue} onLogoHome={handleBackToEntry} />
    );
  }

  if (currentPage === 'success') {
    return <SuccessPage onBackHome={handleBackHome} />;
  }

  if (currentPage === 'cancel') {
    return <CancelPage onBackHome={handleBackHome} />;
  }

  if (currentPage === 'payment' && selectedCategory) {
    return (
      <div className="min-h-screen theme-page flex flex-col relative">
        <EntryDotsCanvas mouse={null} opacityScale={0.75} speedScale={0.75} />
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <Header selectedTab={selectedTab} onTabChange={handleTabChange} onLogoClick={handleBackToEntry} />
        <div className="flex-1 pb-12 overflow-x-hidden">
          <div className="mt-4 sm:mt-6 md:mt-8 pt-2 sm:pt-4 px-3 sm:px-4">
            <PaymentGateway
              category={selectedCategory}
              onBack={() => setCurrentPage('home')}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        </div>
        <Footer />
        </div>
      </div>
    );
  }

  if (currentPage === 'entry') {
    return (
      <EntryChoice
        onChooseActivities={handleChooseActivities}
        onChooseDonations={handleChooseDonations}
        onChooseVenue={handleChooseVenue}
        onBookNow={handleBookNow}
      />
    );
  }

  return (
    <div className="min-h-screen theme-page flex flex-col relative">
      <EntryDotsCanvas mouse={null} opacityScale={0.75} speedScale={0.75} />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
      <Header selectedTab={selectedTab} onTabChange={handleTabChange} onLogoClick={handleBackToEntry} onDonateNow={handleDonateNow} />
      <div className="flex-1">
      <div className="max-w-7xl mx-auto px-3 pt-6 pb-6 sm:px-4 sm:pt-8 sm:pb-8 md:pt-10 md:pb-12">
        <BackButton
          onClick={() => {
            handleBackToEntry();
            window.scrollTo(0, 0);
          }}
          className="mb-4 sm:mb-6 ml-4 sm:ml-5"
        />
        <div className="mb-6 sm:mb-8 md:mb-12 text-center">
          <ScrollReveal fadeOnly>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 md:mb-8">
              Support Our Studio Space Renovations
            </h1>
          </ScrollReveal>
          <ScrollReveal className="space-y-3 sm:space-y-4 max-w-3xl mx-auto">
            <p className="text-base sm:text-lg text-gray-600">
              Since the beginning, Studio Space has hosted more than 62 community events, all offered free of charge and
              made possible entirely through volunteer work, with no external funding.
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              To continue offering this space to the community, we now need to undertake essential structural renovations
              that go beyond what volunteers can do on their own.
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              As you can see in the photos, part of the roof has been damaged, causing water leaks that have affected the
              walls and ceiling. To prevent further deterioration, we need to repair the roof, replace several windows,
              and insulate the walls.
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              There is also an unused 8 m² area that requires extensive work, including insulation, proper drainage, and
              full restoration before it can become part of the studio.
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              The bathroom also requires a complete renovation. Due to ongoing water leaks, moisture and mold have
              developed over time, issues that are also visible in the photos. Restoring it will require rebuilding the
              space and addressing the underlying causes of the damage.
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              These are not cosmetic improvements. They are major structural renovations that require professional
              contractors, specialized work, and construction materials.
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              To complete these renovations, Studio Space is raising <strong>€14,300</strong>.
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              If this space has been meaningful to you (or if you believe in creating places where people can gather,
              learn, create, and connect) we warmly invite you to support this campaign. Every contribution, no matter
              its size, helps ensure that Studio Space can continue serving the community for years to come.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal fadeOnly>
          <ImageCarousel />
        </ScrollReveal>

        {categories.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-center max-w-2xl mx-auto mb-4 sm:mb-6 md:mb-8">
            <p className="text-blue-800 text-xs sm:text-sm">
              {import.meta.env.VITE_SUPABASE_URL ? (
                <>Showing demo categories. Run <code className="bg-blue-100 px-1 rounded">supabase db push</code> from your project folder to load categories from your database.</>
              ) : (
                <>Showing demo categories. To use your database: add <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in GitHub → Settings → Secrets and variables → Actions, then run <code className="bg-blue-100 px-1 rounded">supabase db push</code>. Push a new commit or re-run the workflow to redeploy.</>
              )}
            </p>
          </div>
        )}

        {specificCategories.length > 0 && (
          <section aria-labelledby="causes-heading" className="mt-10 sm:mt-12 md:mt-16 mb-6 sm:mb-8 md:mb-12">
            <div
              className="w-8 sm:w-10 h-1 rounded-full"
              style={{ backgroundColor: '#c95b2d' }}
              aria-hidden
            />
            <ScrollReveal fadeOnly>
              <h2
                id="causes-heading"
                className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 pt-4 sm:pt-6 md:pt-8"
              >
                Causes
              </h2>
            </ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
              {specificCategories.map((category) => {
                const isCompleted =
                  category.current_amount >= category.target_amount && category.target_amount > 0;
                return (
                <section
                  key={category.id}
                  id={`category-${category.id}`}
                  className={`rounded-xl sm:rounded-2xl shadow-md p-4 sm:p-6 md:p-8 border border-gray-100 flex flex-col gap-4 sm:gap-6 transition-shadow duration-200 ease-out hover:shadow-xl ${
                    isCompleted
                      ? 'theme-surface-muted opacity-75 pointer-events-none'
                      : 'theme-surface'
                  }`}
                >
                  <ScrollReveal>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">
                        {category.name}
                      </h3>
                      <p className="text-gray-600 text-sm sm:text-base">{category.description}</p>
                    </div>
                    <div>
                      <div className="flex justify-between items-baseline mb-2 sm:mb-4">
                        <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                          €{category.current_amount.toLocaleString()}
                        </span>
                        <span className="text-sm sm:text-base md:text-lg text-gray-500">
                          of €{category.target_amount.toLocaleString()} goal
                        </span>
                      </div>
                      <div className="relative w-full h-2.5 sm:h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full transition-all duration-700 ease-out rounded-full"
                          style={{
                            width: `${Math.min(
                              (category.current_amount / category.target_amount) * 100,
                              100
                            )}%`,
                            backgroundColor: '#c95b2d',
                          }}
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3">
                        {category.current_amount >= category.target_amount && category.target_amount > 0 ? (
                          <span className="font-semibold text-green-600">Completed</span>
                        ) : (
                          `${Math.min(
                            (category.current_amount / category.target_amount) * 100,
                            100
                          ).toFixed(1)}% funded`
                        )}
                      </p>
                    </div>
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        disabled={isCompleted}
                        onClick={() => handleDonate(category)}
                        className="flex-1 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg text-sm sm:text-base transition-all duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#c95b2d' }}
                      >
                        Donate Now
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleShare(e, category)}
                        disabled={isCompleted}
                        className="flex-shrink-0 p-2.5 sm:p-3 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Share link to donate to ${category.name}`}
                      >
                        <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                    </div>
                  </ScrollReveal>
                </section>
                );
              })}
            </div>
          </section>
        )}

        {generalCategory && (
          <section
            id={`category-${generalCategory.id}`}
            className="theme-surface rounded-xl sm:rounded-2xl shadow-md p-4 sm:p-6 md:p-8 border border-gray-100 flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-12 transition-shadow duration-200 ease-out hover:shadow-xl"
          >
            <ScrollReveal>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                  {generalCategory.name}
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">{generalCategory.description}</p>
              </div>
              <div className="mt-3 sm:mt-4">
                <div className="flex justify-between items-baseline mb-2 sm:mb-4">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
                    €{generalCategory.current_amount.toLocaleString()}
                  </span>
                  <span className="text-sm sm:text-base md:text-lg text-gray-500">
                    of €{generalCategory.target_amount.toLocaleString()} goal
                  </span>
                </div>
                <div className="relative w-full h-2.5 sm:h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full transition-all duration-700 ease-out rounded-full"
                    style={{
                      width: `${Math.min(
                        (generalCategory.current_amount / Math.max(generalCategory.target_amount, 1)) * 100,
                        100
                      )}%`,
                      backgroundColor: '#c95b2d',
                    }}
                  />
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3">
                  {`${Math.min(
                    (generalCategory.current_amount / Math.max(generalCategory.target_amount, 1)) * 100,
                    100
                  ).toFixed(1)}% funded`}
                </p>
              </div>
              <div className="flex items-stretch gap-2 mt-5 sm:mt-6">
                <button
                  onClick={() => handleDonate(generalCategory)}
                  className="flex-1 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg text-sm sm:text-base transition-all duration-200 shadow-md hover:shadow-lg"
                  style={{ backgroundColor: '#c95b2d' }}
                >
                  Donate Now
                </button>
                <button
                  type="button"
                  onClick={(e) => handleShare(e, generalCategory)}
                  className="flex-shrink-0 p-2.5 sm:p-3 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  aria-label={`Share link to donate to ${generalCategory.name}`}
                >
                  <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </ScrollReveal>
          </section>
        )}

        <section className="mt-10 sm:mt-12 md:mt-16">
          <AllDonors />
        </section>

        <section className="mt-10 sm:mt-12 md:mt-16">
          <WordsOfSupport />
        </section>
      </div>
      </div>
      <Footer />
      </div>
    </div>
  );
}

export default App;
