import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Footer } from './Footer';
import { buildAppPath } from '../lib/routes';

export type LegalPageKind = 'privacy-policy' | 'cookie-policy' | 'terms-of-service';

const CONTACT_EMAIL = 'bookings@studiospace.community';
const COOKIE_PREFS_KEY = 'studio-space-cookie-preferences';

/** Set true when a privacy-friendly analytics provider is wired and the opt-in row should appear. */
const ANALYTICS_PREFERENCE_AVAILABLE = false;

interface LegalPageProps {
  page: LegalPageKind;
  onHome: () => void;
}

interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

type CookiePreferences = {
  necessary: true;
  analytics: boolean;
};

const defaultCookiePreferences: CookiePreferences = {
  necessary: true,
  analytics: false,
};

const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  intro:
    'This Privacy Policy explains how Studio Space, operating under the United Human Beings Foundation (UHB), handles personal information when you visit the site, donate, purchase physical goods or paid activities when they are offered, book the venue, join activities, or subscribe to updates.',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        'Studio Space is a community space in Prishtina operating under the United Human Beings Foundation (UHB), dedicated to educational activities, personal development, and social engagement. Through the website, Studio Space may also offer physical goods for sale alongside community activities and donations.',
        `For privacy requests, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Information we collect',
      bullets: [
        'Newsletter and email preferences: email address, marketing opt-in status, unsubscribe status, preference settings, and unsubscribe tokens.',
        'Donations: donation amount, donation category, donor name, email address, anonymous/public display choice, optional words of support, payment reference, and timestamps.',
        'Orders for physical goods: purchaser name, email address, phone number if provided, shipping or delivery address, ordered items, order amount, payment reference, fulfillment status, and timestamps.',
        'Venue bookings: selected dates and times, full name, phone number, email address, activity type, group size, notes, approval status, and timestamps.',
        'Activity registrations and join requests: full name, email address, phone number if provided, selected activity or activities, attendance notes, payment status where relevant, future activity notes, and timestamps.',
        'Email delivery and engagement records: email type, opaque tracking id, sent-log timestamp, and whether an email was opened or a link was clicked.',
        'Basic technical information that may be processed by our hosting, database, email, and payment providers when the site or emails are used.',
      ],
    },
    {
      heading: 'How we use information',
      bullets: [
        'To process donations and keep donation records.',
        'To process orders for physical goods, arrange delivery or collection, and keep order records.',
        'To process registrations and payments for paid activities when they are offered.',
        'To show donor names and words of support publicly unless the donor chooses to appear anonymous.',
        'To respond to venue booking requests and manage booking availability.',
        'To manage activity join requests and contact participants.',
        'To send confirmations, operational emails, newsletters, and studio updates where permitted.',
        'To manage unsubscribe and email preference requests.',
        'To understand whether Studio Space emails are being delivered, opened, and clicked.',
        'To protect the site, prevent misuse, and meet accounting or legal obligations.',
      ],
    },
    {
      heading: 'Public donation display',
      paragraphs: [
        'If you donate and do not choose anonymous display, your donor name, donation amount, donation category, and optional words of support may appear publicly on the site. If you choose anonymous display, we show the donation as anonymous while still keeping the information needed to process and record the donation.',
      ],
    },
    {
      heading: 'Who can access information',
      paragraphs: [
        'Access is limited to the core Studio Space/UHB admin team that needs the information to handle donations, physical goods orders, paid activity registrations, bookings, activities, email preferences, and related operations.',
      ],
    },
    {
      heading: 'Service providers',
      paragraphs: [
        'We use trusted service providers to run the site and related services. These include SUPABASE PTE. LTD. ("Supabase") for database and Edge Functions, RESEND C.I.C. ("Resend") for email sending and contact sync, PayPal for PayPal and card donations, Paysera Kosova SH.P.K. ("Paysera") for bank-transfer donations, and GitHub, Inc. ("GitHub") for hosting. These providers process information only as needed to provide their services to us.',
        'Payment-related information may be processed for donations, for physical goods purchases, and for paid activities when they are offered. Card and bank details are handled by the payment provider. Studio Space does not store card or bank details.',
      ],
    },
    {
      heading: 'Retention',
      paragraphs: [
        'We keep personal information only for as long as needed for the purposes above, including donation records, physical goods order and delivery records, paid activity records, booking and activity administration, email preferences, security, and legal or accounting duties. When information is no longer needed, we delete it or keep it only in a limited archived form where legally necessary.',
      ],
    },
    {
      heading: 'Your choices and rights',
      bullets: [
        'You can unsubscribe or manage email preferences from links in Studio Space emails.',
        'You can contact us to ask for access, correction, deletion, restriction, or objection where applicable.',
        'You can ask questions about how your information is used by emailing us.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `For privacy questions or requests, email ${CONTACT_EMAIL}. We may need enough information to identify the relevant record before we can act on a request.`,
      ],
    },
  ],
};

const cookiePolicy: LegalDocument = {
  title: 'Cookie Policy',
  intro:
    'This Cookie Policy explains how Studio Space uses cookies and similar technologies on this website.',
  sections: [
    {
      heading: 'Current cookie use',
      paragraphs: [
        'The Studio Space website does not intentionally set analytics or advertising cookies right now. The site uses the information you submit through forms.',
      ],
    },
    {
      heading: 'Necessary technologies',
      paragraphs: [
        'Some technologies are necessary for the site to work, such as loading pages, submitting forms for donations, physical goods orders, bookings, or activities, protecting requests, and connecting to services like Supabase. These are treated as necessary and cannot be turned off from this page.',
      ],
    },
    {
      heading: 'Future analytics',
      paragraphs: [
        'Studio Space may add privacy-friendly analytics later to understand general site usage. Until then, analytics cookies are not used on this site. If analytics are added, this policy will be updated and a preference control will be available so you can choose whether to allow that category.',
      ],
    },
    {
      heading: 'External services',
      paragraphs: [
        'When you leave this site for an external service, such as Google Maps, Instagram, PayPal, or Paysera (including when paying for donations, physical goods, or paid activities), those services may use their own cookies or similar technologies under their own policies.',
      ],
    },
    {
      heading: 'Managing cookies',
      paragraphs: [
        'The summary below lists necessary cookies and similar technologies treated as essential for core site operations, including checkout and payment-related flows when physical goods or other paid offerings are available. You can also use your browser or device settings to block, delete, or limit cookies and site-specific data.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about this Cookie Policy can be sent to ${CONTACT_EMAIL}.`],
    },
  ],
};

const termsOfService: LegalDocument = {
  title: 'Terms of Service',
  intro:
    'These Terms of Service describe the basic rules for using the Studio Space website, donating, purchasing physical goods when they are offered, paying for activities when they are offered, submitting booking requests, and joining activities.',
  sections: [
    {
      heading: 'About Studio Space',
      paragraphs: [
        'Studio Space is a community space operating under the United Human Beings Foundation (UHB), dedicated to educational activities, personal development, and social engagement.',
        'Visitors can find information and register for events such as workshops, discussions, film screenings, well-being activities, and other community-oriented programs. Studio Space may also offer physical goods for sale through the website.',
      ],
    },
    {
      heading: 'Using the site',
      paragraphs: [
        'Please use the site lawfully, respectfully, and only for its intended purposes. Do not submit false information, interfere with the site, or use it in a way that harms Studio Space, UHB, other visitors, participants, or the physical space.',
      ],
    },
    {
      heading: 'Bookings',
      paragraphs: [
        'Submitting a venue booking form is a request, not an automatic confirmed booking. Studio Space will review availability and contact you to confirm, adjust, or decline the request.',
      ],
    },
    {
      heading: 'Activities',
      paragraphs: [
        'Submitting an activity join form lets Studio Space know that you are interested in participating. Details may change, and Studio Space may contact you with practical information about the activity.',
        'When paid activities are offered, users may pay online to participate in workshops, events, programs, or similar activities. These activities are educational and community-oriented, and revenues are used to support and sustain the initiative.',
      ],
    },
    {
      heading: 'Physical goods and delivery',
      paragraphs: [
        'Studio Space may sell physical goods through the website. When you purchase physical goods, you may be asked to provide delivery or collection details so the order can be fulfilled.',
        'Delivery timing, collection options, shipping costs if any, and other fulfillment details will be communicated at checkout or afterward by email. Services such as participation in activities may also be offered and may take place physically at Studio Space or, in some cases, online. After payment for an activity, participants receive confirmation and relevant attendance details.',
      ],
    },
    {
      heading: 'Donations and payments',
      paragraphs: [
        'PayPal and card donations are processed through PayPal. Bank-transfer donations use the Paysera account details shown on the donation form. Studio Space does not store card or bank details.',
        'Donations made through the United Human Beings Foundation (UHB) are voluntary and generally non-refundable, except where there is an obvious error such as a duplicate payment, unauthorized transaction, or similar issue.',
        `If you believe a donation or purchase was made in error, contact ${CONTACT_EMAIL} with enough information for us to identify the payment.`,
      ],
    },
    {
      heading: 'Paid activity and goods refunds',
      paragraphs: [
        'Payments for participation in paid activities are generally non-refundable. If Studio Space or the organizer cancels an activity, participants are entitled to a full refund or the option to transfer their payment to another activity.',
        'If a participant cannot attend, refund or transfer requests may be reviewed case by case.',
        'For physical goods, refund or replacement requests for damaged, missing, or incorrect items may be reviewed case by case. Contact Studio Space promptly with your order details so we can help.',
      ],
    },
    {
      heading: 'Public support messages',
      paragraphs: [
        'If you submit words of support with a donation, Studio Space may display them publicly unless you choose anonymous display where available. Studio Space/UHB may moderate, edit, hide, or remove public support messages if needed for safety, clarity, respect, or site operation.',
      ],
    },
    {
      heading: 'Respectful use of the space',
      paragraphs: [
        'Visitors, participants, donors, purchasers, and booking requesters are expected to act respectfully and safely, follow lawful use, and avoid harming people, property, or the space. Studio Space may refuse, cancel, or limit access where needed to protect the community or the space.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'Studio Space may update these terms or the policies linked in the footer when the site, services, or legal needs change. The latest version will be posted on this site.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about these terms can be sent to ${CONTACT_EMAIL}.`],
    },
  ],
};

const documents: Record<LegalPageKind, LegalDocument> = {
  'privacy-policy': privacyPolicy,
  'cookie-policy': cookiePolicy,
  'terms-of-service': termsOfService,
};

function loadCookiePreferences(): CookiePreferences {
  if (typeof window === 'undefined') return defaultCookiePreferences;
  try {
    const raw = window.localStorage.getItem(COOKIE_PREFS_KEY);
    if (!raw) return defaultCookiePreferences;
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
    };
  } catch {
    return defaultCookiePreferences;
  }
}

function CookiePreferencesPanelStatic() {
  return (
    <section
      id="cookie-preferences"
      className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="cookie-preferences-heading"
    >
      <h2 id="cookie-preferences-heading" className="text-lg font-semibold text-gray-900">
        Cookie preferences
      </h2>
      <div className="mt-4 space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md border border-gray-100 bg-gray-50 p-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Necessary</h3>
            <p className="mt-1 text-sm text-gray-600">
              Required for basic site operation, security, and connecting to core services.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white">
            <Check className="h-3 w-3" aria-hidden />
            Always on
          </span>
        </div>
      </div>
    </section>
  );
}

function CookiePreferencesPanelInteractive() {
  const [preferences, setPreferences] = useState<CookiePreferences>(loadCookiePreferences);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const persisted: CookiePreferences = {
      necessary: true,
      analytics: preferences.analytics,
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(persisted));
    }
    setPreferences(persisted);
    setSaved(true);
  };

  return (
    <section
      id="cookie-preferences"
      className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="cookie-preferences-heading"
    >
      <h2 id="cookie-preferences-heading" className="text-lg font-semibold text-gray-900">
        Cookie preferences
      </h2>
      <div className="mt-4 space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md border border-gray-100 bg-gray-50 p-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Necessary</h3>
            <p className="mt-1 text-sm text-gray-600">
              Required for basic site operation and remembering these preferences.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white">
            <Check className="h-3 w-3" aria-hidden />
            Always on
          </span>
        </div>

        <label className="flex items-start justify-between gap-4 rounded-md border border-gray-100 bg-gray-50 p-3">
          <span>
            <span className="block text-sm font-semibold text-gray-900">Privacy-friendly analytics</span>
            <span className="mt-1 block text-sm text-gray-600">
              Allow privacy-friendly analytics to help us understand general site usage.
            </span>
          </span>
          <input
            type="checkbox"
            checked={preferences.analytics}
            onChange={(e) => {
              setPreferences({ necessary: true, analytics: e.target.checked });
              setSaved(false);
            }}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#c95b2d] focus:ring-[#c95b2d]"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Save preferences
        </button>
        {saved && (
          <p className="text-sm text-green-700" role="status">
            Preferences saved.
          </p>
        )}
      </div>
    </section>
  );
}

function CookiePreferencesPanel() {
  return ANALYTICS_PREFERENCE_AVAILABLE ? <CookiePreferencesPanelInteractive /> : <CookiePreferencesPanelStatic />;
}

export function LegalPage({ page, onHome }: LegalPageProps) {
  const doc = documents[page];

  return (
    <div className="min-h-screen theme-page flex flex-col">
      <main className="flex-1 px-4 py-8 sm:py-10">
        <article className="mx-auto max-w-3xl">
          <a
            href={buildAppPath('/')}
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to home
          </a>

          <header className="mt-6 border-b border-gray-200 pb-6">
            <p className="text-sm font-medium uppercase text-gray-500">Studio Space</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{doc.title}</h1>
            <p className="mt-3 text-sm text-gray-500">Last updated: September 26, 2026</p>
            <p className="mt-5 text-base leading-7 text-gray-700">{doc.intro}</p>
          </header>

          <div className="mt-8 space-y-8">
            {doc.sections.map((section) => (
              <section key={section.heading} aria-labelledby={`${page}-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                <h2
                  id={`${page}-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  className="text-xl font-semibold text-gray-900"
                >
                  {section.heading}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-base leading-7 text-gray-700">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-gray-700">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {page === 'cookie-policy' && <CookiePreferencesPanel />}
        </article>
      </main>
      <Footer />
    </div>
  );
}
