import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

const ask = async (question, fallback = '') => {
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
  return answer || fallback;
};

const askYes = async (question, fallback = 'n') => {
  const answer = (await ask(`${question} (s/n)`, fallback)).toLowerCase();
  return answer.startsWith('s') || answer.startsWith('y');
};

const slugify = value => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const compactArtistName = value => String(value || '')
  .toLowerCase()
  .replace(/^(el|la|los|las)\s+/i, '')
  .split(/\s+/)
  .filter(Boolean)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const svg = {
  spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 2.96 3.48 2.81 1.1-.01 2.15-.65 2.72-1.59.19-.33.4-.67.41-1.06.10-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><path d="M7.75 2C4.57 2 2 4.57 2 7.75v8.5C2 19.43 4.57 22 7.75 22h8.5C19.43 22 22 19.43 22 16.25v-8.5C22 4.57 19.43 2 16.25 2h-8.5zm0 2h8.5A3.75 3.75 0 0120 7.75v8.5A3.75 3.75 0 0116.25 20h-8.5A3.75 3.75 0 014 16.25v-8.5A3.75 3.75 0 017.75 4zm8.75 1a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.5v-7l6 3.5-6 3.5z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24"><path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0022 12z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'
};

const trackingHead = `<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-VGKG8CCY6L"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-VGKG8CCY6L');
</script>
<!-- End Google Analytics -->
<!-- Microsoft Clarity -->
<script>
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "wziogq92mh");
</script>
<!-- End Microsoft Clarity -->
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '670742718071367');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->
<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
  ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
  ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
  for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
  ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
  ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
  ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
  n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;
  e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('D857IOBC77U70JIQN4BG');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`;

const trackingNoScript = `<noscript>
  <img height="1" width="1" style="display:none" alt=""
    src="https://www.facebook.com/tr?id=670742718071367&ev=PageView&noscript=1">
</noscript>`;

const trackingBodyScript = `<script>
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

  const trackClarityEvent = eventName => {
    if (typeof window.clarity !== 'function') return;
    window.clarity('event', eventName);
  };

  const releaseAnalyticsEndpoint = 'https://admin.lujourban.com/api/analytics/release-event';
  const releaseAnalyticsSent = new Set();

  const detectAnalyticsDevice = () => {
    const text = navigator.userAgent.toLowerCase();
    if (/ipad|tablet|kindle|playbook/.test(text)) return 'tablet';
    if (/mobi|android|iphone|ipod/.test(text)) return 'mobile';
    return 'desktop';
  };

  const sendReleaseAnalyticsEvent = (releaseSlug, artistSlug, eventType, onceKey = '') => {
    if (!releaseSlug || !['view', 'chat_click', 'status_click'].includes(eventType)) return;

    const key = onceKey || (eventType + ':' + releaseSlug);
    if (releaseAnalyticsSent.has(key)) return;
    releaseAnalyticsSent.add(key);

    const payload = {
      release_slug: releaseSlug,
      artist_slug: artistSlug || null,
      event_type: eventType,
      source_url: window.location.href,
      referrer: document.referrer || '',
      device_type: detectAnalyticsDevice()
    };

    try {
      window.fetch(releaseAnalyticsEndpoint, {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch {
      // Analytics must never block the artist profile.
    }
  };

  const trackedOnce = new Set();
  const trackEvent = (eventName, params = {}, once = false) => {
    const key = eventName + ':' + (params.label || params.section || params.content_name || '');
    if (once && trackedOnce.has(key)) return;
    if (once) trackedOnce.add(key);

    trackMetaEvent(eventName, params);
    trackTikTokEvent(eventName, params);
    trackGoogleEvent(eventName, params);
    trackClarityEvent(eventName);
  };

  window.setTimeout(() => trackEvent('artistas_interes_10s', {
    label: 'time_on_page',
    seconds: 10
  }, true), 10000);

  window.setTimeout(() => trackEvent('artistas_interes_30s', {
    label: 'time_on_page',
    seconds: 30
  }, true), 30000);

  const fadeElements = document.querySelectorAll('.fade-up');
  if (fadeElements.length && 'IntersectionObserver' in window) {
    const fadeObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1 });

    fadeElements.forEach(element => fadeObserver.observe(element));
  } else {
    fadeElements.forEach(element => element.classList.add('visible'));
  }

  document.querySelectorAll('[data-track-event]').forEach(element => {
    if (element.tagName === 'IFRAME') return;

    element.addEventListener('click', () => {
      trackEvent(element.dataset.trackEvent, {
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
        trackEvent(player.dataset.trackEvent, {
          label: player.dataset.trackLabel || '',
          content_name: player.title || player.src
        }, true);
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
        const releaseSlug = element.dataset.releaseSlug || '';
        if (releaseSlug) {
          sendReleaseAnalyticsEvent(releaseSlug, element.dataset.artistSlug || '', 'view', 'view:' + releaseSlug);
        }

        trackEvent(element.dataset.viewEvent, {
          label: element.dataset.viewLabel || '',
          section: element.querySelector('.section-label, h1, h2')?.textContent.trim() || ''
        }, true);
        viewObserver.unobserve(element);
      });
    }, { threshold: 0.35 });

    trackedViews.forEach(element => viewObserver.observe(element));
  }
</script>`;

const copyAsset = async (source, slug, suffix) => {
  if (!source) return '';
  const extension = extname(source) || '.jpg';
  const target = `assets/${slug}-${suffix}${extension.toLowerCase()}`;
  await copyFile(source, target);
  return target;
};

const initials = name => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join('');

const trackingSlug = artist => artist.slug.replace(/-/g, '_');

const imageOrPlaceholder = (artist, className, prefix = '') => artist.photo
  ? `<img class="${className}" src="${prefix}${artist.photo}" alt="${escapeHtml(artist.name)}">`
  : `<div class="${className}" aria-label="Foto pendiente de ${escapeHtml(artist.name)}"><span>${escapeHtml(initials(artist.name))}</span></div>`;

const renderHeroPhoto = artist => artist.photo
  ? `<div class="hero-photo">
  <img src="../../${artist.photo}" alt="${escapeHtml(artist.name)}">
</div>`
  : `<div class="hero-photo artist-hero-placeholder" aria-label="Foto pendiente de ${escapeHtml(artist.name)}">
  <span>${escapeHtml(initials(artist.name))}</span>
</div>`;

const renderSocialGrid = artist => {
  const links = Object.entries(artist.links || {}).filter(([, url]) => url);
  if (!links.length) return '';

  const eventSlug = trackingSlug(artist);
  const socialOrder = ['tiktok', 'spotify', 'instagram', 'youtube', 'facebook', 'whatsapp'];
  const labels = { spotify: 'Spotify', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook', whatsapp: 'WhatsApp' };
  return `<div class="divider"></div>
<section class="fade-up" data-view-event="artista_${eventSlug}_redes_vista" data-view-label="artist_social_grid">
  <div class="social-grid">
${socialOrder.filter(key => artist.links?.[key]).map(key => `    <a href="${escapeHtml(artist.links[key])}" target="_blank" rel="noopener" class="social-item" data-track-event="artista_${eventSlug}_${key}_click" data-track-label="artist_${key}">
      ${svg[key] || ''}
      ${labels[key] || key}
    </a>`).join('\n')}
  </div>
</section>`;
};

const heroButtons = artist => {
  const buttons = [];
  const eventSlug = trackingSlug(artist);
  const buttonIcon = key => (svg[key] || '').replace('<svg viewBox="0 0 24 24"', '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"');

  if (artist.links?.spotify) {
    buttons.push(`<a href="${escapeHtml(artist.links.spotify)}" target="_blank" rel="noopener" class="btn-primary" data-track-event="artista_${eventSlug}_hero_spotify_click" data-track-label="artist_hero_spotify">
      ${svg.spotify.replace('<svg viewBox="0 0 24 24"', '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"')}
      Escucha ahora
    </a>`);
  }

  if (artist.links?.tiktok) {
    buttons.push(`<a href="${escapeHtml(artist.links.tiktok)}" target="_blank" rel="noopener" class="btn-secondary" data-track-event="artista_${eventSlug}_hero_tiktok_click" data-track-label="artist_hero_tiktok">
      ${buttonIcon('tiktok')}
      TikTok
    </a>`);
  }

  buttons.push(`<a href="/artistas/" class="btn-secondary" data-track-event="artistas_directorio_click" data-track-label="artist_hero_artistas">
      Artistas
    </a>`);

  return buttons.join('\n    ');
};

const renderRelease = artist => {
  if (!artist.release?.title || !artist.release?.link) return '';

  const eventSlug = trackingSlug(artist);
  const cover = artist.release.cover
    ? `<img src="../../${artist.release.cover}" alt="Portada de ${escapeHtml(artist.release.title)}">`
    : `<div class="artist-photo-placeholder" aria-hidden="true"><span>${escapeHtml(initials(artist.release.title))}</span></div>`;

  return `<div class="divider divider-music-inner"></div>
<section class="fade-up" data-view-event="artista_${eventSlug}_release_visto" data-view-label="artist_release" data-release-slug="${escapeHtml(artist.release.slug || '')}" data-artist-slug="${escapeHtml(artist.slug)}">
  <p class="section-label">Último lanzamiento</p>
  <div class="release-card">
    <div class="release-status">
      <p><span class="release-status-dot" aria-hidden="true"></span>Ya disponible</p>
    </div>
    <div class="release-feature">
      <a href="${escapeHtml(artist.release.link)}" target="_blank" rel="noopener" class="release-cover-link" data-track-event="artista_${eventSlug}_release_portada_click" data-track-label="artist_release_cover" data-track-content="${escapeHtml(artist.release.title)}">${cover}</a>
      <div class="release-feature-copy">
        <h2>${escapeHtml(artist.release.title)}</h2>
        <p>${escapeHtml(artist.name)}</p>
        <div class="release-actions">
          <a href="${escapeHtml(artist.release.link)}" target="_blank" rel="noopener" data-track-event="artista_${eventSlug}_release_escuchar_click" data-track-label="artist_release_button" data-track-content="${escapeHtml(artist.release.title)}">Escuchar ahora</a>
        </div>
      </div>
    </div>
  </div>
</section>`;
};

const renderEmbedSection = (title, kicker, embed, eventName) => {
  if (!embed) return '';

  return `<div class="divider divider-music-inner"></div>
<section class="fade-up" data-view-event="${escapeHtml(eventName)}" data-view-label="${escapeHtml(title.toLowerCase())}">
  <p class="section-label">${escapeHtml(title)}</p>
  <div class="beats-card">
    <div class="beats-info">
      <p class="beats-kicker">${escapeHtml(kicker)}</p>
    </div>
    <iframe
      title="${escapeHtml(title)}"
      data-track-event="${escapeHtml(eventName)}"
      data-track-label="${escapeHtml(title.toLowerCase())}"
      src="${escapeHtml(embed)}"
      height="352" style="width:100%;border:none;display:block;"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy">
    </iframe>
  </div>
</section>`;
};

const renderContact = artist => {
  if (!artist.contact?.url) return '';

  const eventSlug = trackingSlug(artist);
  return `<div class="divider"></div>
<section class="fade-up">
  <p class="section-label">Contacto</p>
  <div class="contact-card">
    <a href="${escapeHtml(artist.contact.url)}" class="btn-send" target="_blank" rel="noopener" data-track-event="artista_${eventSlug}_contacto_click" data-track-label="artist_contact">${escapeHtml(artist.contact.label || 'Contacto')}</a>
  </div>
</section>`;
};

const renderArtistPage = artist => {
  const eventSlug = trackingSlug(artist);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${escapeHtml(`${artist.name}, ${artist.role.toLowerCase()} de Lujo Urban. ${artist.tagline}`)}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="https://www.lujourban.com/artistas/${artist.slug}/">
<meta property="og:type" content="profile">
<meta property="og:url" content="https://www.lujourban.com/artistas/${artist.slug}/">
<meta property="og:site_name" content="LUJO URBAN">
<meta property="og:title" content="${escapeHtml(`${artist.name} - Lujo Urban`)}">
<meta property="og:description" content="${escapeHtml(artist.tagline)}">
<meta property="og:image" content="https://www.lujourban.com/${artist.photo || 'assets/zaetta-music-logo.jpg'}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(`${artist.name} - Lujo Urban`)}">
<meta name="twitter:description" content="${escapeHtml(artist.tagline)}">
<meta name="twitter:image" content="https://www.lujourban.com/${artist.photo || 'assets/zaetta-music-logo.jpg'}">
<title>${escapeHtml(`${artist.name} - Lujo Urban`)}</title>
<link rel="icon" href="../../assets/zaetta-music-logo.jpg" type="image/jpeg">
<link rel="stylesheet" href="../../styles.css">
${trackingHead}
</head>
<body class="artist-page">

<a href="https://casa.lujourban.com" class="lujourban-home-link" data-track-event="artista_${eventSlug}_lujourban_casa_click" data-track-label="lujourban_home_link" data-track-content="LUJO URBAN"><span>LUJO URBAN</span></a>

${trackingNoScript}
<main>
${renderHeroPhoto(artist)}

<div class="hero-info fade-up" data-view-event="artista_${eventSlug}_hero_visto" data-view-label="artist_hero">
  <h1 class="hero-name">${escapeHtml(artist.name)}</h1>
  <p class="hero-role">${escapeHtml(artist.role)}</p>
  <p class="hero-sub">${escapeHtml(artist.tagline)}</p>
  <div class="hero-btns">
    ${heroButtons(artist)}
  </div>
</div>
${renderSocialGrid(artist)}
${renderRelease(artist)}
${renderEmbedSection('Beats', 'Catálogo de beats', artist.beatsEmbed, `artista_${eventSlug}_beats_visto`)}
${renderEmbedSection('Producciones', 'Producciones destacadas', artist.productionsEmbed, `artista_${eventSlug}_producciones_visto`)}
${renderContact(artist)}
</main>
${trackingBodyScript}
</body>
</html>
`;
};

const renderDirectory = artists => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Artistas aliados de Lujo Urban. Talento, lanzamientos y proyectos con identidad de marca.">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="https://www.lujourban.com/artistas/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.lujourban.com/artistas/">
<meta property="og:site_name" content="LUJO URBAN">
<meta property="og:title" content="Artistas - Lujo Urban">
<meta property="og:description" content="Conoce los artistas aliados de Lujo Urban.">
<meta property="og:image" content="https://www.lujourban.com/assets/lujo.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Artistas - Lujo Urban">
<meta name="twitter:description" content="Conoce los artistas aliados de Lujo Urban.">
<meta name="twitter:image" content="https://www.lujourban.com/assets/lujo.png">
<title>Artistas - Lujo Urban</title>
<link rel="icon" href="../assets/lujo.png" type="image/png">
<link rel="stylesheet" href="../styles.css">
${trackingHead}
</head>
<body class="artists-page">
${trackingNoScript}
<header class="artists-nav">
  <span class="artists-brand-spacer" aria-hidden="true"></span>
  <a href="/" class="artists-back" aria-label="Volver al inicio" data-track-event="artistas_nav_volver_click" data-track-label="artists_nav_back">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 5.2 8 12l6.8 6.8M8.9 12H20"/></svg>
  </a>
</header>

<main>
  <section class="artists-hero" data-view-event="artistas_directorio_visto" data-view-label="artists_directory_hero">
    <p class="artists-kicker">Lujo Urban presenta</p>
    <h1 class="artists-logo-title">
      <img src="../assets/hola.png" alt="" aria-hidden="true">
      <span>Zaetta Music</span>
    </h1>
    <div class="artists-glow-line" aria-hidden="true"></div>
    <p class="artists-hero-sub">Artistas oficiales</p>
  </section>

  <section class="artists-section" aria-label="Roster oficial de artistas">
    <div class="artist-list ${artists.length > 1 ? 'artist-list--grid' : 'artist-list--single'}" aria-label="Artistas de Lujo Urban">
${artists.map(artist => `    <a href="/artistas/${artist.slug}/" class="artist-list-card" data-track-event="artista_${trackingSlug(artist)}_directorio_click" data-track-label="artist_directory_card" data-track-content="${escapeHtml(artist.name)}">
      ${imageOrPlaceholder(artist, 'artist-photo-placeholder', '../')}
      <div class="artist-list-copy">
        <h2>${escapeHtml(artist.cardName || compactArtistName(artist.name))}</h2>
        <span class="artist-list-accent" aria-hidden="true"></span>
        <small>${escapeHtml(artist.tagline)}</small>
        <span class="artist-list-cta">Ver perfil</span>
      </div>
      <span class="artist-list-arrow" aria-hidden="true">→</span>
    </a>`).join('\n')}
    </div>
  </section>

  <section class="artists-proof" aria-label="Valores Lujo Urban">
    <div>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13h-2V7.35l-8 1.33V18a3 3 0 11-2-2.83z"/></svg>
      <h2>Talento real</h2>
      <p>Conectamos con artistas que están haciendo historia.</p>
    </div>
    <div>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.28L22 9.1l-5.25 4.72L18.18 21 12 17.3 5.82 21l1.43-7.18L2 9.1l7.1-.82L12 2z"/></svg>
      <h2>Visión global</h2>
      <p>Llevamos tu música a nuevas audiencias y oportunidades.</p>
    </div>
    <div>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 8-8 12-8-12 8-8zm0 3.2L7.35 9.85 12 16.82l4.65-6.97L12 5.2zm-2.8 5.3L12 14.7l2.8-4.2L12 7.7l-2.8 2.8z"/></svg>
      <h2>Identidad lujo</h2>
      <p>Calidad, estrategia y excelencia en cada proyecto.</p>
    </div>
  </section>

  <a href="/" class="artists-label-cta" data-track-event="artistas_lujo_urban_cta_click" data-track-label="artists_label_cta">
    <img class="artists-label-logo" src="../assets/lujo.png" alt="" aria-hidden="true">
    <span>
      <strong>Lujo Urban</strong>
      <small>Movimiento. Visión. Legado.</small>
    </span>
    <em>Conoce más →</em>
  </a>
</main>
${trackingBodyScript}
</body>
</html>
`;

const updateSitemap = async artists => {
  let sitemap = await readFile('sitemap.xml', 'utf8');
  sitemap = sitemap.replace(/\n  <url>\n    <loc>https:\/\/www\.lujourban\.com\/artistas\/[\s\S]*?(?=\n<\/urlset>)/, '');
  const artistUrls = [`  <url>
    <loc>https://www.lujourban.com/artistas/</loc>
    <lastmod>2026-06-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`].concat(artists.map(artist => `  <url>
    <loc>https://www.lujourban.com/artistas/${artist.slug}/</loc>
    <lastmod>2026-06-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`));

  await writeFile('sitemap.xml', sitemap.replace('\n</urlset>', `\n${artistUrls.join('\n')}\n</urlset>`));
};

const buildArtists = async data => {
  await mkdir('artistas', { recursive: true });
  await Promise.all(data.artists.map(async artist => {
    await mkdir(`artistas/${artist.slug}`, { recursive: true });
    await writeFile(`artistas/${artist.slug}/index.html`, renderArtistPage(artist));
  }));

  await Promise.all([
    writeFile('artist-data.json', `${JSON.stringify(data, null, 2)}\n`),
    writeFile('artistas/index.html', renderDirectory(data.artists)),
    updateSitemap(data.artists)
  ]);
};

try {
  const data = await readFile('artist-data.json', 'utf8').then(JSON.parse);

  if (process.argv.includes('--build')) {
    await buildArtists(data);
    console.log('Paginas de artistas reconstruidas.');
    process.exit(0);
  }

  const name = await ask('Nombre artistico');
  if (!name) throw new Error('El nombre artistico no puede quedar vacio.');

  const slug = slugify(await ask('Nombre corto sin espacios ni tildes', slugify(name)));
  if (!slug) throw new Error('El nombre corto no puede quedar vacio.');

  const role = await ask('Rol visible', 'Artista aliado');
  const cardName = await ask('Nombre corto para la tarjeta', compactArtistName(name));
  const tagline = await ask('Frase corta', 'Música con identidad, visión y propósito.');
  const bio = await ask('Bio corta', `Perfil oficial de ${name} dentro del ecosistema Lujo Urban.`);
  const photoSource = await ask('Ruta de foto principal (dejalo vacio si aun no tienes foto)');
  const photo = await copyAsset(photoSource, slug, 'photo');

  const links = {};
  for (const key of ['spotify', 'tiktok', 'instagram', 'youtube', 'facebook', 'whatsapp']) {
    const url = await ask(`Link de ${key} (opcional)`);
    if (url) links[key] = url;
  }

  let release = null;
  if (await askYes('Tiene ultimo lanzamiento para mostrar')) {
    const title = await ask('Nombre del lanzamiento');
    const link = await ask('Link del lanzamiento');
    const coverSource = await ask('Ruta de portada del lanzamiento (opcional)');
    const cover = await copyAsset(coverSource, slug, 'release');
    release = title && link ? { title, link, cover } : null;
  }

  const beatsEmbed = await ask('Embed de beats Spotify/BeatStars (opcional)');
  const productionsEmbed = await ask('Embed de producciones Spotify/YouTube (opcional)');
  let contact = null;
  if (await askYes('Tiene boton de contacto o booking')) {
    const label = await ask('Texto del boton de contacto', 'Booking');
    const url = await ask('Link del contacto');
    contact = url ? { label, url } : null;
  }

  const nextArtist = { name, cardName, slug, role, tagline, bio, photo, links, release, beatsEmbed, productionsEmbed, contact };
  const index = data.artists.findIndex(artist => artist.slug === slug);
  if (index === -1) data.artists.push(nextArtist);
  else data.artists[index] = nextArtist;

  await buildArtists(data);

  console.log('\nArtista generado correctamente.');
  console.log(`Pagina: https://www.lujourban.com/artistas/${slug}/`);
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
