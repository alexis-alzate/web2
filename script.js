const latestRelease = {
  title: "Predicador",
  trackingTitle: "Predicador",
  slug: "predicador",
  artist: 'ZAETTA',
  cover: "assets/predicador-cover.jpg",
  link: "https://open.spotify.com/track/5C52EVyuczyiEvYGr4wDK5?si=tXpu1_WGRriQA3E8-DvPWA",
  shareUrl: "https://www.lujourban.com/lanzamientos/predicador-v4/",
  browserTitle: "ZAETTA - Escucha Predicador",
  heroText: "Música con propósito. Sonidos que trascienden."
};

const siteFeatures = {
  showVipCommunity: false
};

document.querySelectorAll('[data-vip-community]').forEach(element => {
  element.hidden = !siteFeatures.showVipCommunity;
});

const releaseSlug = (latestRelease.slug || latestRelease.trackingTitle || latestRelease.title)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

const heroImage = document.getElementById('heroBg');
if (heroImage) {
  heroImage.src = 'assets/hero.jpg';
}

document.title = latestRelease.browserTitle;

document.querySelectorAll('[data-release-hero-text]').forEach(element => {
  element.textContent = latestRelease.heroText;
});

document.querySelectorAll('[data-release-link]').forEach(link => {
  link.href = latestRelease.link;
  link.dataset.trackContent = latestRelease.trackingTitle || latestRelease.title;
});

document.querySelectorAll('[data-release-action]').forEach(element => {
  element.dataset.trackEvent = `release_${releaseSlug}_${element.dataset.releaseAction}`;
});

document.querySelectorAll('[data-release-title]').forEach(element => {
  element.textContent = latestRelease.title;
});

document.querySelectorAll('[data-release-artist]').forEach(element => {
  element.textContent = latestRelease.artist;
});

document.querySelectorAll('[data-release-cover]').forEach(image => {
  image.src = latestRelease.cover;
  image.alt = `Portada de ${latestRelease.trackingTitle || latestRelease.title}`;
});

document.querySelectorAll('[data-release-view]').forEach(element => {
  element.dataset.viewEvent = `release_${releaseSlug}_${element.dataset.releaseView}`;
  element.dataset.viewLabel = `release_${releaseSlug}`;
});

document.querySelectorAll('[data-share-button]').forEach(button => {
  button.addEventListener('click', async () => {
    const shareData = {
      title: latestRelease.browserTitle,
      text: latestRelease.heroText,
      url: latestRelease.shareUrl
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== 'AbortError') console.error('No se pudo compartir el lanzamiento.', error);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(latestRelease.shareUrl);
      window.alert('Enlace del lanzamiento copiado.');
    } catch {
      window.prompt('Copia el enlace del lanzamiento:', latestRelease.shareUrl);
    }
  });
});

// Fade-up on scroll
const _obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      _obs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach(el => _obs.observe(el));

const trackMetaEvent = (eventName, params = {}) => {
  if (typeof window.fbq !== 'function') return;
  window.fbq('trackCustom', eventName, params);
};

const trackTikTokEvent = (eventName, params = {}) => {
  if (!window.ttq || typeof window.ttq.track !== 'function') return;
  window.ttq.track(eventName, params);
};

const trackGoogleEvent = (eventName, params = {}) => {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
};

const trackClarityEvent = (eventName) => {
  if (typeof window.clarity !== 'function') return;
  window.clarity('event', eventName);
};

const saveClarityOwnerFromUrl = () => {
  const url = new URL(window.location.href);
  if (url.searchParams.get('owner') !== 'zaetta-alexis') return;

  try {
    window.localStorage.setItem('zaetta_clarity_owner_id', 'zaetta-owner-alexis');
    url.searchParams.delete('owner');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // localStorage can be unavailable when the browser blocks site storage.
  }
};

const identifyClarityOwner = () => {
  if (typeof window.clarity !== 'function') return;

  try {
    const ownerId = window.localStorage.getItem('zaetta_clarity_owner_id');
    if (!ownerId) return;

    window.clarity('identify', ownerId, undefined, undefined, 'ZAETTA Owner');
    window.clarity('set', 'visitor_type', 'owner');
  } catch {
    // localStorage can be unavailable when the browser blocks site storage.
  }
};

saveClarityOwnerFromUrl();
identifyClarityOwner();

const trackedOnce = new Set();
const trackMetaEventOnce = (eventName, params = {}) => {
  const key = `${eventName}:${params.label || ''}`;
  if (trackedOnce.has(key)) return;
  trackedOnce.add(key);
  trackMetaEvent(eventName, params);
  trackTikTokEvent(eventName, params);
  trackGoogleEvent(eventName, params);
  trackClarityEvent(eventName);
};

window.setTimeout(() => {
  trackMetaEventOnce('interes_10s', {
    label: 'time_on_page',
    seconds: 10
  });
}, 10000);

window.setTimeout(() => {
  trackMetaEventOnce('interes_30s', {
    label: 'time_on_page',
    seconds: 30
  });
}, 30000);

const scrollMilestones = [
  { eventName: 'interes_scroll_50', percent: 50 },
  { eventName: 'interes_scroll_90', percent: 90 }
];

let isScrolling = false;
const trackScrollMilestones = () => {
  if (isScrolling) return;

  isScrolling = true;
  window.requestAnimationFrame(() => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable > 0) {
      const currentPercent = Math.round((window.scrollY / scrollable) * 100);
      scrollMilestones.forEach(milestone => {
        if (currentPercent < milestone.percent) return;

        trackMetaEventOnce(milestone.eventName, {
          label: 'scroll_depth',
          percent: milestone.percent
        });
      });
    }
    isScrolling = false;
  });
};

window.addEventListener('scroll', trackScrollMilestones, { passive: true });

document.querySelectorAll('[data-track-event]').forEach(element => {
  if (element.tagName === 'IFRAME') return;

  element.addEventListener('click', () => {
    trackMetaEvent(element.dataset.trackEvent, {
      label: element.dataset.trackLabel || '',
      content_name: element.dataset.trackContent || element.textContent.trim(),
      destination: element.href || ''
    });
    trackTikTokEvent(element.dataset.trackEvent, {
      label: element.dataset.trackLabel || '',
      content_name: element.dataset.trackContent || element.textContent.trim(),
      destination: element.href || ''
    });
    trackGoogleEvent(element.dataset.trackEvent, {
      label: element.dataset.trackLabel || '',
      content_name: element.dataset.trackContent || element.textContent.trim(),
      destination: element.href || ''
    });
    trackClarityEvent(element.dataset.trackEvent);
  });
});

const trackedPlayers = document.querySelectorAll('iframe[data-track-event]');
if (trackedPlayers.length) {
  const playerObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const player = entry.target;
      trackMetaEventOnce(player.dataset.trackEvent, {
        label: player.dataset.trackLabel || '',
        content_name: player.title || player.src
      });
      playerObserver.unobserve(player);
    });
  }, { threshold: 0.45 });

  trackedPlayers.forEach(player => playerObserver.observe(player));
}

const trackedViews = document.querySelectorAll('[data-view-event]');
if (trackedViews.length) {
  const viewObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const element = entry.target;
      trackMetaEventOnce(element.dataset.viewEvent, {
        label: element.dataset.viewLabel || '',
        section: element.querySelector('.section-label')?.textContent.trim() || ''
      });
      viewObserver.unobserve(element);
    });
  }, { threshold: 0.35 });

  trackedViews.forEach(element => viewObserver.observe(element));
}
