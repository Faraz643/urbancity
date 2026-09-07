const API = (import.meta.env.VITE_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');

function visitorId() {
  let id = localStorage.getItem('urbancity_visitor_id');
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem('urbancity_visitor_id', id);
  }
  return id;
}

function setClickBadge(heading: Element, total: number) {
  const badge = heading.querySelector<HTMLElement>('[data-ad-total-clicks]');
  if (badge) badge.textContent = `${Math.max(0, total).toLocaleString()} clicks`;
}

async function refreshClickTotal(heading: Element, bookingId: string) {
  try {
    const response = await fetch(
      `${API}/api/advertisements/clicks/${encodeURIComponent(bookingId)}?t=${Date.now()}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return;
    const result = await response.json();
    if (typeof result?.totalClicks === 'number') setClickBadge(heading, result.totalClicks);
  } catch {
    // Click tracking must never break the billboard popup.
  }
}

function findCompanyLink(heading: Element) {
  return (
    heading.querySelector<HTMLAnchorElement>('a.company-link') ||
    heading.querySelector<HTMLAnchorElement>('a[href]')
  );
}

function ensureBadge(heading: Element, initialTotal = 0) {
  let badge = heading.querySelector<HTMLElement>('[data-ad-total-clicks]');
  if (!badge) {
    badge = document.createElement('span');
    badge.dataset.adTotalClicks = 'true';
    badge.style.cssText =
      'display:inline-flex;align-items:center;margin-left:10px;padding:3px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:11px;font-weight:700;color:#aeb9c8;vertical-align:middle;white-space:nowrap;';
    badge.textContent = `${Math.max(0, initialTotal).toLocaleString()} clicks`;
    heading.appendChild(badge);
  }
  return badge;
}

function getActiveBookingFromWindow(heading: Element, companyLink: HTMLAnchorElement) {
  const displayedName = (companyLink.firstChild?.textContent || '').trim();
  if (!displayedName) return null;

  // The popup's existing booking data is exposed on the page by the app.
  // Use it when available so the count can be painted without waiting for
  // another network request.
  const candidates = [
    (window as any).__URBANCITY_ACTIVE_BOOKINGS__,
    (window as any).activeBookings,
  ];

  for (const active of candidates) {
    if (!active || typeof active !== 'object') continue;
    const match = Object.values(active).find(
      (booking: any) => String(booking?.companyName || '').trim() === displayedName,
    );
    if (match) return match as any;
  }

  return null;
}

async function enhanceActiveAd() {
  const heading = document.querySelector('.panel h2');
  const companyLink = heading ? findCompanyLink(heading) : null;
  if (!heading || !companyLink) return;

  // Paint the badge immediately if the application has already exposed the
  // active booking. The server request below is only the authoritative refresh.
  const immediateMatch = getActiveBookingFromWindow(heading, companyLink);
  if (immediateMatch) {
    const bookingId = String(immediateMatch.id || '').trim();
    const destination = String(
      immediateMatch.targetUrl || immediateMatch.siteUrl || immediateMatch.user?.websiteUrl || companyLink.href || '',
    ).trim();
    if (destination) {
      companyLink.href = destination;
      companyLink.target = '_blank';
      companyLink.rel = 'noopener noreferrer';
    }
    companyLink.title = destination ? `Visit ${destination}` : 'Visit advertiser website';
    ensureBadge(heading, Number(immediateMatch.totalClicks || 0));
    if (bookingId) {
      companyLink.dataset.bookingId = bookingId;
      void refreshClickTotal(heading, bookingId);
    }
  }

  try {
    const response = await fetch(`${API}/api/bookings/active?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return;

    const active = (await response.json()) as Record<string, any>;
    const displayedName = (companyLink.firstChild?.textContent || '').trim();
    const match = Object.values(active).find(
      (booking: any) => String(booking.companyName || '').trim() === displayedName,
    );
    if (!match) return;

    const bookingId = String(match.id || '').trim();
    const destination = String(
      match.targetUrl || match.siteUrl || match.user?.websiteUrl || companyLink.href || '',
    ).trim();

    if (destination) {
      companyLink.href = destination;
      companyLink.target = '_blank';
      companyLink.rel = 'noopener noreferrer';
    }

    companyLink.title = destination ? `Visit ${destination}` : 'Visit advertiser website';
    ensureBadge(heading, Number(match.totalClicks || 0));

    if (!bookingId) return;
    companyLink.dataset.bookingId = bookingId;
    void refreshClickTotal(heading, bookingId);
  } catch {
    // Never interfere with the billboard popup.
  }
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    void enhanceActiveAd();
  });
}

export function installAdClickTracker() {
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      'a.company-link, .panel h2 a[href]',
    );
    if (!link) return;

    const bookingId = String(link.dataset.bookingId || '').trim();
    if (!bookingId) return;

    const heading = link.closest('h2');
    const badge = heading?.querySelector<HTMLElement>('[data-ad-total-clicks]');
    const current = Number((badge?.textContent || '').match(/\d[\d,]*/)?.[0]?.replace(/,/g, '') || 0);
    if (badge) badge.textContent = `${(current + 1).toLocaleString()} clicks`;

    const trackingUrl =
      `${API}/api/advertisements/click/${encodeURIComponent(bookingId)}` +
      `?visitorId=${encodeURIComponent(visitorId())}&track=1`;

    try {
      void fetch(trackingUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: '',
        keepalive: true,
      }).catch(() => {});
    } catch {}

    try {
      navigator.sendBeacon?.(trackingUrl, new Blob([], { type: 'text/plain' }));
    } catch {}

    if (heading) {
      window.setTimeout(() => void refreshClickTotal(heading, bookingId), 700);
      window.setTimeout(() => void refreshClickTotal(heading, bookingId), 1800);
    }
  });

  scheduleEnhance();
}
