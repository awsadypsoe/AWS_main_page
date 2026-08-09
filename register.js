/* ============================================================
   AWS SBG ADYPSOE — register.js
   Event Registration — Hands-on Expert Session (Aug 10, 2026)
   Backend: Supabase (table: registrations, storage: payment-screenshots)
   ============================================================ */
'use strict';

/* ── 1. SUPABASE CONFIG ────────────────────────────────────── */
const DEFAULT_MAX_SEATS = 100;
const DEFAULT_STORAGE_BUCKET = 'payment-screenshots';

let db;
let supabaseInitPromise = null;
let maxSeats = DEFAULT_MAX_SEATS;
let storageBucket = DEFAULT_STORAGE_BUCKET;

async function loadAwsClubConfig() {
  if (window.awsClubConfigPromise) {
    return window.awsClubConfigPromise;
  }

  if (!loadAwsClubConfig.promise) {
    loadAwsClubConfig.promise = fetch('/api/config', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Config request failed (${response.status})`);
        }

        return response.json();
      })
      .catch(error => {
        console.warn('Config endpoint unavailable, falling back to defaults.', error);
        return {
          WEB3FORMS_ACCESS_KEY: '',
          SUPABASE_URL: '',
          SUPABASE_ANON_KEY: '',
          MAX_SEATS: String(DEFAULT_MAX_SEATS),
          STORAGE_BUCKET: DEFAULT_STORAGE_BUCKET,
        };
      });
  }

  return loadAwsClubConfig.promise;
}

async function ensureSupabase() {
  if (db) return db;

  if (!supabaseInitPromise) {
    supabaseInitPromise = (async () => {
      const config = await loadAwsClubConfig();
      const supabaseUrl = (config.SUPABASE_URL || '').trim();
      const supabaseAnonKey = (config.SUPABASE_ANON_KEY || '').trim();

      maxSeats = Number(config.MAX_SEATS || DEFAULT_MAX_SEATS) || DEFAULT_MAX_SEATS;
      storageBucket = (config.STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET).trim() || DEFAULT_STORAGE_BUCKET;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase config is not set');
      }

      db = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      return db;
    })().catch(error => {
      supabaseInitPromise = null;
      throw error;
    });
  }

  return supabaseInitPromise;
}


/* ── 2. SEAT COUNTER — fetch, render, realtime ─────────────── */
let currentCount = 0;

async function fetchSeatCount() {
  try {
    const client = await ensureSupabase();
    if (!client) return;

    const { count, error } = await db
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .in('payment_status', ['pending_verification', 'confirmed']);

    if (!error && typeof count === 'number') {
      currentCount = count;
      renderSeatUI(currentCount);
    }
  } catch (err) {
    console.warn('Seat count error:', err);
  }
}

function renderSeatUI(filled) {
  const capacity  = Math.max(1, maxSeats);
  const remaining = Math.max(0, capacity - filled);
  const pct       = Math.min((filled / capacity) * 100, 100);

  const elFilled    = document.getElementById('seatFilled');
  const elRemaining = document.getElementById('seatRemaining');
  const elBar       = document.getElementById('seatBar');
  const elWrap      = document.getElementById('seatCounterWrap');
  const elLiveBadge = document.getElementById('seatLiveBadge');

  if (elFilled)    elFilled.textContent    = filled + ' / ' + capacity;
  if (elRemaining) elRemaining.textContent = remaining + ' seat' + (remaining === 1 ? '' : 's') + ' remaining';
  if (elBar)       elBar.style.width       = pct + '%';

  if (elWrap) {
    elWrap.classList.remove('seat-counter-closed', 'closed', 'urgent');
    if (remaining <= 10) elWrap.classList.add('urgent');
    elWrap.removeAttribute('aria-hidden');
  }

  if (elLiveBadge) {
    elLiveBadge.style.display = 'inline-flex';
    elLiveBadge.innerHTML = '<div class="seat-live-dot"></div>LIVE';
  }

  if (remaining <= 0) triggerSeatsFull();
}

function triggerSeatsFull() {
  const banner = document.getElementById('seatsBanner');
  if (banner && !banner.classList.contains('visible')) {
    banner.classList.add('visible');
    /* Disable form elements */
    document.querySelectorAll('#step1 input, #step1 select, #btnStep1').forEach(el => {
      el.disabled = true;
    });
    /* Update hero button */
    const heroBtn = document.getElementById('heroRegBtn');
    if (heroBtn) {
      heroBtn.textContent = '— ALL SEATS TAKEN —';
      heroBtn.classList.replace('btn-primary', 'btn-outline');
      heroBtn.style.pointerEvents = 'none';
      heroBtn.style.opacity = '0.6';
    }
  }
}

/* ── Realtime: listen to INSERT and UPDATE events ── */
function initRealtime() {
  if (!db) return;

  db.channel('reg-seat-updates')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'registrations' },
      (payload) => {
        console.log('↑ New registration inserted — refreshing seat count');
        fetchSeatCount();
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'registrations' },
      (payload) => {
        /* Status change (e.g. pending → confirmed or rejected) may alter count */
        console.log('↻ Registration updated — refreshing seat count');
        fetchSeatCount();
      }
    )
    .subscribe(status => {
      const liveBadge = document.getElementById('seatLiveBadge');
      if (status === 'SUBSCRIBED') {
        console.log('✓ Realtime connected');
        if (liveBadge) liveBadge.style.display = 'inline-flex';
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime disconnected — polling fallback active');
        if (liveBadge) liveBadge.style.display = 'none';
      }
    });
}

/* ── 3. STEP NAVIGATION ────────────────────────────────────── */
let currentStep  = 1;
let formData     = {};
let uploadedFile = null;

function goToStep(step) {
  /* Hide all step panels */
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));

  /* Target panel */
  const targetId = step === 'success' ? 'stepSuccess' : 'step' + step;
  const target   = document.getElementById(targetId);
  if (target) target.classList.add('active');

  /* Update dots, connectors, labels */
  for (let i = 1; i <= 3; i++) {
    const dot  = document.getElementById('dot'  + i);
    const lbl  = document.getElementById('lbl'  + i);
    const conn = document.getElementById('conn' + i);

    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (lbl) lbl.classList.remove('active', 'done');

    if (step === 'success' || (typeof step === 'number' && i < step)) {
      dot.classList.add('done');
      if (lbl) lbl.classList.add('done');
    } else if (i === step) {
      dot.classList.add('active');
      if (lbl) lbl.classList.add('active');
    }

    if (conn) {
      const isDone = step === 'success' || (typeof step === 'number' && i < step);
      conn.classList.toggle('done', isDone);
    }
  }

  /* On success: hide step indicator */
  if (step === 'success') {
    const indicator = document.getElementById('stepIndicator');
    const labels    = document.querySelector('.step-labels-row');
    if (indicator) indicator.style.display = 'none';
    if (labels)    labels.style.display    = 'none';
  }

  currentStep = step;

  /* Scroll to form section */
  const formSection = document.getElementById('register');
  if (formSection) {
    const top = formSection.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}


/* ── 4. STEP 1 — VALIDATE DETAILS ──────────────────────────── */
document.getElementById('btnStep1')?.addEventListener('click', () => {
  const name     = document.getElementById('regName')?.value.trim()    || '';
  const email    = document.getElementById('regEmail')?.value.trim()   || '';
  const phone    = document.getElementById('regPhone')?.value.trim()   || '';
  const college  = document.getElementById('regCollege')?.value.trim() || '';
  const year     = document.getElementById('regYear')?.value           || '';
  const referral = document.getElementById('regReferral')?.value       || '';

  if (!name || !email || !phone || !college || !year) {
    showToast('⚠ PLEASE FILL ALL FIELDS!', 'error'); return;
  }
  if (!referral) {
    showToast('⚠ PLEASE TELL US HOW YOU HEARD ABOUT THE EVENT!', 'error'); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('⚠ ENTER A VALID EMAIL ADDRESS!', 'error'); return;
  }
  if (!/^[6-9]\d{9}$/.test(phone.replace(/[\s\-]/g, ''))) {
    showToast('⚠ ENTER A VALID 10-DIGIT PHONE!', 'error'); return;
  }

  formData = { name, email, phone, college, year, referral_source: referral };
  goToStep(2);
});


/* ── 5. STEP 2 — PAYMENT NAVIGATION ────────────────────────── */
document.getElementById('btnStep2')?.addEventListener('click', () => goToStep(3));
document.getElementById('btnBackTo1')?.addEventListener('click', () => goToStep(1));


/* ── 6. COPY UPI ID ────────────────────────────────────────── */
document.getElementById('copyUpiBtn')?.addEventListener('click', () => {
  const upiId = document.getElementById('upiIdText')?.textContent.trim() || '';
  const btn   = document.getElementById('copyUpiBtn');
  if (!btn) return;

  const done = () => {
    btn.textContent = 'COPIED!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'COPY'; btn.classList.remove('copied'); }, 2200);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(upiId).then(done).catch(() => fallbackCopy(upiId, done));
  } else {
    fallbackCopy(upiId, done);
  }
});

function fallbackCopy(text, cb) {
  const ta = Object.assign(document.createElement('textarea'), {
    value: text, style: 'position:fixed;opacity:0;'
  });
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  cb();
}


/* ── 7. FILE UPLOAD HANDLING ───────────────────────────────── */
const uploadZone      = document.getElementById('uploadZone');
const fileInput       = document.getElementById('screenshotInput');
const preview         = document.getElementById('uploadPreview');
const previewImg      = document.getElementById('previewImg');
const previewFilename = document.getElementById('previewFilename');

fileInput?.addEventListener('change', e => handleFile(e.target.files?.[0]));

uploadZone?.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone?.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-over'));
uploadZone?.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  handleFile(e.dataTransfer?.files?.[0]);
});

function handleFile(file) {
  if (!file) return;
  const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!ALLOWED.includes(file.type)) {
    showToast('⚠ PLEASE UPLOAD PNG / JPG / WEBP IMAGE!', 'error'); return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('⚠ FILE TOO LARGE — MAX 5 MB!', 'error'); return;
  }
  uploadedFile = file;
  const url = URL.createObjectURL(file);
  if (previewImg)      previewImg.src          = url;
  if (previewFilename) previewFilename.textContent = '✓ ' + file.name;
  if (preview)         preview.classList.add('visible');
}


/* ── 8. STEP 3 — SUBMIT REGISTRATION ──────────────────────── */
document.getElementById('btnSubmit')?.addEventListener('click', async () => {
  const utr       = document.getElementById('regUtr')?.value.trim() || '';
  const submitBtn = document.getElementById('btnSubmit');

  if (!uploadedFile) {
    showToast('⚠ PLEASE UPLOAD YOUR PAYMENT SCREENSHOT!', 'error'); return;
  }
  if (!utr || utr.length < 6) {
    showToast('⚠ PLEASE ENTER YOUR UTR / TRANSACTION ID!', 'error'); return;
  }
  try {
    await ensureSupabase();
  } catch (err) {
    console.error('Supabase init failed:', err);
    showToast('⚠ CONNECTION ERROR — PLEASE RELOAD THE PAGE!', 'error');
    return;
  }

  setSubmitLoading(submitBtn, true, '⏳ UPLOADING SCREENSHOT...');

  try {
    /* ── 8a. Upload screenshot → Supabase Storage ── */
    const ext      = (uploadedFile.name.split('.').pop() || 'png').toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const { data: uploadData, error: uploadError } = await db.storage
      .from(storageBucket)
      .upload(fileName, uploadedFile, {
        contentType: uploadedFile.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new Error('Screenshot upload failed — please try again.');

    const { data: urlData } = db.storage.from(storageBucket).getPublicUrl(uploadData.path);
    const screenshotUrl = urlData?.publicUrl || '';

    /* ── 8b. Insert registration row ── */
    setSubmitLoading(submitBtn, true, '⏳ SUBMITTING...');

    const payload = {
      name:                   formData.name,
      email:                  formData.email,
      phone:                  formData.phone,
      college:                formData.college,
      year:                   formData.year,
      referral_source:        formData.referral_source,
      utr_number:             utr,
      payment_screenshot_url: screenshotUrl,
      payment_status:         'pending_verification',
    };

    let { error: insertError } = await db.from('registrations').insert(payload);

    /* Fallback if referral_source column is missing in Supabase schema cache */
    if (insertError && (insertError.message?.includes('referral_source') || insertError.message?.includes('schema cache') || insertError.code === 'PGRST204')) {
      console.warn('referral_source column missing in DB schema — retrying without it');
      delete payload.referral_source;
      const retry = await db.from('registrations').insert(payload);
      insertError = retry.error;
    }

    if (insertError) {
      if (insertError.message?.includes('EVENT_FULL') || insertError.message?.includes('full')) {
        triggerSeatsFull();
        throw new Error(`SORRY! All ${maxSeats} seats are now taken. Registration closed.`);
      }
      if (insertError.code === '23505') {
        throw new Error('This email has already been registered!');
      }
      throw new Error('Registration failed — ' + (insertError.message || 'please try again.'));
    }

    /* ── 8c. SUCCESS ── */
    document.getElementById('successName').textContent  = formData.name;
    document.getElementById('successEmail').textContent = formData.email;
    document.getElementById('successUtr').textContent   = utr;

    fetchSeatCount();   /* immediately refresh counter */
    goToStep('success');

  } catch (err) {
    console.error('Registration error:', err);
    showToast('⚠ ' + (err.message || 'SOMETHING WENT WRONG — TRY AGAIN!'), 'error');
    setSubmitLoading(submitBtn, false, 'SUBMIT REGISTRATION');
  }
});

document.getElementById('btnBackTo2')?.addEventListener('click', () => goToStep(2));


/* ── 10. BOOTSTRAP ─────────────────────────────────────────── */
function applyRegistrationClosedState() {
  const closedState = document.getElementById('registrationClosedState');
  if (closedState) closedState.style.display = 'block';

  const counterWrap = document.getElementById('seatCounterWrap');
  const liveBadge = document.getElementById('seatLiveBadge');
  const remainingEl = document.getElementById('seatRemaining');

  if (counterWrap) {
    counterWrap.classList.add('closed');
    counterWrap.setAttribute('aria-hidden', 'true');
  }
  if (liveBadge) {
    liveBadge.style.display = 'none';
    liveBadge.innerHTML = '<div class="seat-live-dot"></div>CLOSED';
  }
  if (remainingEl) {
    remainingEl.textContent = 'Please contact us on WhatsApp for updates.';
  }

  document.querySelectorAll('.step-indicator, .step-labels-row, .form-steps-wrap').forEach(el => {
    if (el) el.style.display = 'none';
  });

  document.querySelectorAll('#step1 input, #step1 select, #btnStep1, #btnStep2, #btnStep3, #btnSubmit, #copyUpiBtn, #uploadZone, #screenshotInput').forEach(el => {
    if (el) el.disabled = true;
  });
}

(async function bootstrapRegistration() {
  /* Show the registration form — registrations are OPEN */
  const closedBanner = document.getElementById('registrationClosedState');
  if (closedBanner) closedBanner.style.display = 'none';

  const stepIndicator = document.getElementById('stepIndicator');
  const stepLabels    = document.querySelector('.step-labels-row');
  const formWrap      = document.querySelector('.form-steps-wrap');
  if (stepIndicator) stepIndicator.style.display = '';
  if (stepLabels)    stepLabels.style.display    = '';
  if (formWrap)      formWrap.style.display      = '';

  /* Reset hero button to register link */
  const heroBtn = document.getElementById('heroRegBtn');
  if (heroBtn) {
    heroBtn.href = '#register';
    heroBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
        <rect x="3" y="0" width="2" height="4" />
        <rect x="0" y="3" width="8" height="2" />
      </svg>
      REGISTER NOW — ₹149`;
    heroBtn.classList.remove('btn-outline');
    heroBtn.classList.add('btn-primary');
    heroBtn.style.pointerEvents = '';
    heroBtn.style.opacity = '';
  }

  try {
    await ensureSupabase();
    fetchSeatCount();
    initRealtime();
    setInterval(fetchSeatCount, 30_000);
  } catch (error) {
    console.warn('Registration config unavailable:', error);
  }
})();


/* ── 11. HELPERS ───────────────────────────────────────────── */

function setSubmitLoading(btn, loading, label) {
  if (!btn) return;
  btn.textContent    = label;
  btn.disabled       = loading;
  btn.style.opacity  = loading ? '0.7' : '1';
  btn.style.cursor   = loading ? 'not-allowed' : '';
}

function showToast(message, type = 'success') {
  const toast  = document.getElementById('toast');
  const msgEl  = document.getElementById('toastMsg');
  const iconEl = document.getElementById('toastIcon');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;

  const color = type === 'error' ? 'var(--pink)' : '#00C853';
  toast.style.borderColor = color;
  toast.style.color       = color;
  if (iconEl) iconEl.setAttribute('fill', color);

  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
}
