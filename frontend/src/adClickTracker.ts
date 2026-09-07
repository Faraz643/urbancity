const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function visitorId() {
  let id = localStorage.getItem('urbancity_visitor_id');
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem('urbancity_visitor_id', id);
  }
  return id;
}

async function enhanceActiveAd() {
  const heading = document.querySelector('.panel h2');
  const companyLink = heading?.querySelector<HTMLAnchorElement>('a.company-link');
  if (!heading || !companyLink) return;

  try {
    const response = await fetch(`${API}/api/bookings/active`);
    if (!response.ok) return;
    const active = (await response.json()) as Record<string, any>;
    const displayedName = (companyLink.firstChild?.textContent || '').trim();
    const match = Object.values(active).find((booking: any) =>
      String(booking.companyName || '').trim() === displayedName,
    );
    if (!match) return;

    const trackedUrl = `${API}${match.clickUrl}${match.clickUrl.includes('?') ? '&' : '?'}visitorId=${encodeURIComponent(visitorId())}`;
    if (companyLink.href !== trackedUrl) companyLink.href = trackedUrl;
    companyLink.title = 'Visit advertiser website';

    let badge = heading.querySelector<HTMLElement>('[data-ad-total-clicks]');
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.adTotalClicks = 'true';
      badge.style.cssText = 'display:inline-flex;align-items:center;margin-left:10px;padding:3px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:11px;font-weight:700;color:#aeb9c8;vertical-align:middle;white-space:nowrap;';
      heading.appendChild(badge);
    }
    badge.textContent = `↗ ${Number(match.totalClicks || 0).toLocaleString()} clicks`;
  } catch {
    // Click tracking must never prevent the billboard popup from working.
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
    const link = (event.target as HTMLElement | null)?.closest('a.company-link');
    if (link) {
      // The server records the click and then redirects. Do not block navigation.
      const href = link.getAttribute('href');
      if (href && href.includes('/api/advertisements/click/')) return;
    }
  });
  scheduleEnhance();
}
