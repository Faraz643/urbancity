const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

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
    const response = await fetch(`${API}/api/advertisements/clicks/${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const result = await response.json();
    if (typeof result?.totalClicks === 'number') setClickBadge(heading, result.totalClicks);
  } catch {
    // Never interfere with the billboard popup.
  }
}

async function enhanceActiveAd() {
  const heading = document.querySelector('.panel h2');
  const companyLink = heading?.querySelector<HTMLAnchorElement>('a.company-link');
  if (!heading || !companyLink) return;
  try {
    const response = await fetch(`${API}/api/bookings/active`, { cache: 'no-store' });
    if (!response.ok) return;
    const active = (await response.json()) as Record<string, any>;
    const displayedName = (companyLink.firstChild?.textContent || '').trim();
    const match = Object.values(active).find((booking: any) => String(booking.companyName || '').trim() === displayedName);
    if (!match) return;

    const destination = String(match.targetUrl || match.siteUrl || match.user?.websiteUrl || companyLink.href || '').trim();
    if (destination) {
      // Keep the real advertiser URL in href. target=_blank makes the click open only in a new tab.
      companyLink.href = destination;
      companyLink.target = '_blank';
      companyLink.rel = 'noopener noreferrer';
      companyLink.dataset.bookingId = String(match.id || '');
    }
    companyLink.title = destination ? `Visit ${destination}` : 'Visit advertiser website';

    let badge = heading.querySelector<HTMLElement>('[data-ad-total-clicks]');
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.adTotalClicks = 'true';
      badge.style.cssText = 'display:inline-flex;align-items:center;margin-left:10px;padding:3px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:11px;font-weight:700;color:#aeb9c8;vertical-align:middle;white-space:nowrap;';
      heading.appendChild(badge);
    }
    badge.textContent = `${Number(match.totalClicks || 0).toLocaleString()} clicks`;
  } catch {
    // Tracking must never prevent the billboard popup from working.
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
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a.company-link');
    if (!link) return;
    const bookingId = link.dataset.bookingId;
    if (!bookingId) return;

    // Do NOT preventDefault and do NOT assign window.location. The real href + target=_blank
    // controls navigation, so the current UrbanCity tab always stays open.
    const trackingUrl = `${API}/api/advertisements/click/${encodeURIComponent(bookingId)}?visitorId=${encodeURIComponent(visitorId())}&track=1`;

    // Beacon survives the browser's navigation to the new tab and does not alter the destination.
    try {
      const queued = navigator.sendBeacon?.(trackingUrl, new Blob([], { type: 'text/plain' }));
      if (!queued) {
        void fetch(trackingUrl, { method: 'GET', keepalive: true, credentials: 'omit' }).catch(() => {});
      }
    } catch {
      void fetch(trackingUrl, { method: 'GET', keepalive: true, credentials: 'omit' }).catch(() => {});
    }

    const heading = link.closest('h2');
    if (heading) {
      // Read the authoritative server count after the insert has had a moment to commit.
      window.setTimeout(() => void refreshClickTotal(heading, bookingId), 350);
    }
  });

  scheduleEnhance();
}
