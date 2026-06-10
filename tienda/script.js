// ===== CONFIGURACIÓN SUPABASE =====
// Reemplaza con los valores de tu proyecto: Supabase > Project Settings > API
const SUPABASE_URL = 'TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COVERS_BUCKET = 'beats-covers';
const PREVIEWS_BUCKET = 'beats-previews';

const LICENSE_LABELS = {
  basic: { name: 'Básica', desc: 'MP3, uso no exclusivo' },
  premium: { name: 'Premium', desc: 'WAV, uso no exclusivo' },
  exclusive: { name: 'Exclusiva', desc: 'WAV + stems, derechos exclusivos' }
};

const beatsGrid = document.getElementById('beatsGrid');
const previewPlayer = document.getElementById('previewPlayer');

let currentBeats = [];
let activePlayBtn = null;

function formatCOP(value) {
  return '$' + Number(value).toLocaleString('es-CO');
}

function publicUrl(bucket, path) {
  if (!path) return '';
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function loadBeats() {
  const { data, error } = await supabase
    .from('beats')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    beatsGrid.innerHTML = '<p class="beats-loading">No se pudieron cargar los beats.</p>';
    console.error(error);
    return;
  }

  currentBeats = data;
  renderBeats(data);
}

function renderBeats(beats) {
  if (!beats.length) {
    beatsGrid.innerHTML = '<p class="beats-loading">Pronto nuevos beats.</p>';
    return;
  }

  beatsGrid.innerHTML = '';

  beats.forEach(beat => {
    const card = document.createElement('div');
    card.className = 'beat-card';

    const coverUrl = publicUrl(COVERS_BUCKET, beat.cover_url);
    const previewUrl = publicUrl(PREVIEWS_BUCKET, beat.preview_url);
    const meta = [beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.key]
      .filter(Boolean)
      .join(' · ');

    card.innerHTML = `
      <div class="beat-cover">
        <img src="${coverUrl}" alt="Portada de ${beat.title}" loading="lazy">
        ${previewUrl ? `<button type="button" class="beat-play-btn" aria-label="Reproducir preview">▶</button>` : ''}
      </div>
      <div class="beat-info">
        <h3 class="beat-title">${beat.title}</h3>
        <p class="beat-meta">${meta}</p>
        ${beat.status === 'sold_exclusive'
          ? '<p class="beat-sold">Exclusiva vendida</p>'
          : `<p class="beat-price">Desde ${formatCOP(beat.price_basic)}</p>
             <button type="button" class="beat-license-btn" data-beat-id="${beat.id}">Ver licencias</button>`
        }
      </div>
    `;

    if (previewUrl) {
      const playBtn = card.querySelector('.beat-play-btn');
      playBtn.addEventListener('click', () => togglePreview(playBtn, previewUrl));
    }

    if (beat.status !== 'sold_exclusive') {
      card.querySelector('.beat-license-btn').addEventListener('click', () => openModal(beat));
    }

    beatsGrid.appendChild(card);
  });
}

function togglePreview(btn, url) {
  if (activePlayBtn === btn && !previewPlayer.paused) {
    previewPlayer.pause();
    btn.classList.remove('playing');
    btn.textContent = '▶';
    activePlayBtn = null;
    return;
  }

  if (activePlayBtn) {
    activePlayBtn.classList.remove('playing');
    activePlayBtn.textContent = '▶';
  }

  previewPlayer.src = url;
  previewPlayer.play();
  btn.classList.add('playing');
  btn.textContent = '❚❚';
  activePlayBtn = btn;
}

previewPlayer.addEventListener('ended', () => {
  if (activePlayBtn) {
    activePlayBtn.classList.remove('playing');
    activePlayBtn.textContent = '▶';
    activePlayBtn = null;
  }
  modalPlayBtn.classList.remove('playing');
  modalPlayBtn.textContent = '▶';
});

previewPlayer.addEventListener('timeupdate', () => {
  if (!previewPlayer.duration) return;
  const pct = (previewPlayer.currentTime / previewPlayer.duration) * 100;
  modalProgressBar.style.width = pct + '%';
});

// ===== MODAL =====
const modal = document.getElementById('licenseModal');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalMeta = document.getElementById('modalMeta');
const modalPlayBtn = document.getElementById('modalPlayBtn');
const modalProgressBar = document.getElementById('modalProgressBar');
const licenseOptions = document.getElementById('licenseOptions');
const buyerEmail = document.getElementById('buyerEmail');
const buyButton = document.getElementById('buyButton');
const buyError = document.getElementById('buyError');

let currentBeat = null;

function openModal(beat) {
  currentBeat = beat;
  modalTitle.textContent = beat.title;
  modalMeta.textContent = [beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.key]
    .filter(Boolean).join(' · ');

  licenseOptions.innerHTML = '';
  ['basic', 'premium', 'exclusive'].forEach((type, i) => {
    const price = beat[`price_${type}`];
    const label = LICENSE_LABELS[type];
    const option = document.createElement('label');
    option.className = 'license-option';
    option.innerHTML = `
      <input type="radio" name="license" value="${type}" ${i === 0 ? 'checked' : ''}>
      <span class="license-option-label">
        <span class="license-option-name">${label.name}</span>
        <span class="license-option-desc">${label.desc}</span>
      </span>
      <span class="license-option-price">${formatCOP(price)}</span>
    `;
    licenseOptions.appendChild(option);
  });

  buyerEmail.value = '';
  buyError.hidden = true;
  modalProgressBar.style.width = '0%';
  modalPlayBtn.classList.remove('playing');
  modalPlayBtn.textContent = '▶';
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
  if (activePlayBtn === modalPlayBtn) {
    previewPlayer.pause();
    activePlayBtn = null;
  }
  currentBeat = null;
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

modalPlayBtn.addEventListener('click', () => {
  if (!currentBeat) return;
  const previewUrl = publicUrl(PREVIEWS_BUCKET, currentBeat.preview_url);
  togglePreview(modalPlayBtn, previewUrl);
});

buyButton.addEventListener('click', async () => {
  if (!currentBeat) return;

  const email = buyerEmail.value.trim();
  if (!email || !email.includes('@')) {
    buyError.textContent = 'Ingresa un correo válido.';
    buyError.hidden = false;
    return;
  }

  const licenseType = document.querySelector('input[name="license"]:checked').value;
  buyError.hidden = true;
  buyButton.disabled = true;
  buyButton.textContent = 'Procesando...';

  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { beat_id: currentBeat.id, license_type: licenseType, buyer_email: email }
    });

    if (error || !data?.init_point) throw error || new Error('Sin init_point');

    window.location.href = data.init_point;
  } catch (err) {
    console.error(err);
    buyError.textContent = 'Hubo un error al procesar tu compra. Intenta de nuevo.';
    buyError.hidden = false;
    buyButton.disabled = false;
    buyButton.textContent = 'Comprar';
  }
});

loadBeats();
