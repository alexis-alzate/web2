const latestRelease = {
  title: 'Seguire',
  trackingTitle: 'Seguir\u00e9',
  artist: 'ZAETTA',
  cover: 'assets/seguire-cover.jpg',
  link: 'https://too.fm/bkyz4mw'
};

const heroImage = document.getElementById('heroBg');
if (heroImage) {
  heroImage.src = 'assets/hero.jpg';
}

document.querySelectorAll('[data-release-link]').forEach(link => {
  link.href = latestRelease.link;
  link.dataset.trackContent = latestRelease.trackingTitle || latestRelease.title;
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

document.querySelectorAll('[data-view-label="latest_release_card"]').forEach(element => {
  element.dataset.viewLabel = `${(latestRelease.trackingTitle || latestRelease.title).toLowerCase().replace(/\s+/g, '_')}_release_card`;
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

const googleEventNames = {
  ListenClick: 'listen_click',
  SocialClick: 'social_click',
  ContactClick: 'contact_click',
  PlayerView: 'player_view',
  Engaged10s: 'engaged_10s',
  Engaged30s: 'engaged_30s',
  MusicSectionView: 'music_section_view',
  ReleaseCardView: 'release_card_view',
  BeatsSectionView: 'beats_section_view',
  ProductionsSectionView: 'productions_section_view'
};

const trackGoogleEvent = (eventName, params = {}) => {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', googleEventNames[eventName] || eventName, params);
};

const trackedOnce = new Set();
const trackMetaEventOnce = (eventName, params = {}) => {
  const key = `${eventName}:${params.label || ''}`;
  if (trackedOnce.has(key)) return;
  trackedOnce.add(key);
  trackMetaEvent(eventName, params);
  trackTikTokEvent(eventName, params);
  trackGoogleEvent(eventName, params);
};

window.setTimeout(() => {
  trackMetaEventOnce('Engaged10s', {
    label: 'time_on_page',
    seconds: 10
  });
}, 10000);

window.setTimeout(() => {
  trackMetaEventOnce('Engaged30s', {
    label: 'time_on_page',
    seconds: 30
  });
}, 30000);

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
