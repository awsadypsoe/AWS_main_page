/* ============================================================
   AWS STUDENTS BUILDER GROUP ADYPSOE — main.js (revamped)
   ============================================================ */
'use strict';

const AWS_CLUB_CONFIG_ENDPOINT = '/api/config';
const AWS_CLUB_DEFAULT_CONFIG = Object.freeze({
  WEB3FORMS_ACCESS_KEY: '',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  MAX_SEATS: '100',
  STORAGE_BUCKET: 'payment-screenshots',
});

let awsClubConfigPromise = null;

function loadAwsClubConfig() {
  if (!awsClubConfigPromise) {
    awsClubConfigPromise = fetch(AWS_CLUB_CONFIG_ENDPOINT, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Config request failed (${response.status})`);
        }

        const config = await response.json();
        return { ...AWS_CLUB_DEFAULT_CONFIG, ...config };
      })
      .catch(error => {
        console.warn('Config endpoint unavailable, falling back to defaults.', error);
        return { ...AWS_CLUB_DEFAULT_CONFIG };
      });
  }

  return awsClubConfigPromise;
}

window.loadAwsClubConfig = loadAwsClubConfig;
window.awsClubConfigPromise = loadAwsClubConfig();

/* ============================================================
   1. STARFIELD CANVAS
   ============================================================ */
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [], shootingStars = [];
  const STAR_COUNT = 200;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8 + 0.4,
        a: Math.random(),
        speed: Math.random() * 0.25 + 0.04,
        twinkle: Math.random() * Math.PI * 2,
        color: Math.random() > 0.88
          ? (Math.random() > 0.5 ? '#FF9900' : '#FF2D78')
          : '#C9B8FF',
      });
    }
  }

  function spawnShootingStar() {
    if (Math.random() > 0.012) return;
    shootingStars.push({
      x: Math.random() * W * 0.8,
      y: Math.random() * H * 0.3,
      len: Math.random() * 90 + 50,
      speed: Math.random() * 8 + 5,
      a: 1,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
    });
  }

  function drawShootingStars() {
    shootingStars = shootingStars.filter(s => s.a > 0);
    shootingStars.forEach(s => {
      const dx = Math.cos(s.angle) * s.len * s.a;
      const dy = Math.sin(s.angle) * s.len * s.a;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x + dx, s.y + dy);
      grad.addColorStop(0, `rgba(255,255,255,${s.a})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + dx, s.y + dy);
      ctx.stroke();
      ctx.restore();
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.a -= 0.022;
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    spawnShootingStar();
    drawShootingStars();
    stars.forEach(s => {
      s.twinkle += 0.018;
      const alpha = (0.35 + 0.65 * (Math.sin(s.twinkle) * 0.5 + 0.5)) * s.a;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = s.r > 1.4 ? 5 : 0;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      s.y -= s.speed * 0.08;
      if (s.y < 0) { s.y = H; s.x = Math.random() * W; }
    });
    requestAnimationFrame(draw);
  }

  resize(); createStars(); draw();
  window.addEventListener('resize', () => { resize(); createStars(); }, { passive: true });
})();


/* ============================================================
   2. PIXEL PARTICLES
   ============================================================ */
(function initParticles() {
  const container = document.getElementById('pixelParticles');
  if (!container) return;
  const COLORS = ['#FF2D78', '#FF9900', '#C9B8FF', '#4A9EFF'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'pixel-particle';
    const size = [4, 6, 8][Math.floor(Math.random() * 3)];
    p.style.cssText = `
      left:${Math.random() * 100}%;
      width:${size}px; height:${size}px;
      background:${COLORS[Math.floor(Math.random() * COLORS.length)]};
      animation-duration:${Math.random() * 18 + 14}s;
      animation-delay:${Math.random() * -25}s;
      image-rendering:pixelated;
    `;
    container.appendChild(p);
  }
})();


/* ============================================================
   3. NAVBAR
   ============================================================ */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
  function closeMenu() {
    navLinks?.classList.remove('open');
    navToggle?.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }
  navToggle?.addEventListener('click', () => {
    const isOpen = navLinks?.classList.toggle('open');
    navToggle?.classList.toggle('open', isOpen);
    navToggle?.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });
  document.addEventListener('click', e => {
    if (navLinks?.classList.contains('open') &&
      !navLinks.contains(e.target) &&
      !navToggle?.contains(e.target)) {
      closeMenu();
    }
  });
})();


/* ============================================================
   4. PARALLAX — boss floats on scroll
   ============================================================ */
(function initParallax() {
  const boss = document.getElementById('heroBoss');
  const nebula = document.querySelector('.hero-nebula');
  if (!boss) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      if (boss) boss.style.transform = `translateY(${sy * 0.1}px)`;
      if (nebula) nebula.style.transform = `translateY(${sy * 0.05}px)`;
      ticking = false;
    });
  }, { passive: true });
})();


/* ============================================================
   5. SCROLL REVEAL
   ============================================================ */
(function initReveal() {
  const selectors = [
    '.event-card', '.team-card', '.team-card-captain',
    '.social-card', '.about-content', '.join-form',
    '.cert-image-wrap', '.hero-hud',
  ];
  const els = document.querySelectorAll(selectors.join(','));
  els.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 4) * 0.07}s`;
  });
  const obs = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    }),
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
  );
  els.forEach(el => obs.observe(el));
})();


/* ============================================================
   6. SCROLLSPY — highlight active nav link
   ============================================================ */
(function initScrollspy() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-link');
  if (!sections.length) return;
  const obs = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => { l.style.color = ''; });
        const active = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
        if (active) active.style.color = 'var(--accent-pink)';
      }
    }),
    { threshold: 0.4 }
  );
  sections.forEach(s => obs.observe(s));
})();


/* ============================================================
   7. SMOOTH ANCHOR SCROLL
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
  });
});


/* ============================================================
   8. JOIN FORM SUBMISSION
   ============================================================ */
(function initForm() {
  const form = document.getElementById('joinForm');
  const submitBtn = document.getElementById('submitBtn');
  const toast = document.getElementById('toast');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.textContent = '⏳ SENDING...';
    submitBtn.disabled = true;

    try {
      const config = await loadAwsClubConfig();
      const web3FormsAccessKey = config.WEB3FORMS_ACCESS_KEY.trim();

      if (!web3FormsAccessKey) {
        throw new Error('Web3Forms access key is not configured');
      }

      const formData = new FormData(form);
      formData.append('access_key', web3FormsAccessKey);

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        submitBtn.textContent = '✓ INVITE SENT!';
        submitBtn.style.background = '#00C853';
        submitBtn.style.boxShadow = '4px 4px 0 #007A30';
        form.reset();
        toast?.classList.add('show');
        setTimeout(() => toast?.classList.remove('show'), 4500);
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      console.error('Submission Error:', error);
      submitBtn.textContent = '❌ ERROR! TRY AGAIN';
      submitBtn.style.background = '#FF2D78';
      submitBtn.style.boxShadow = '4px 4px 0 #9B0033';
    } finally {
      setTimeout(() => {
        submitBtn.textContent = '⚔ ENTER THE DUNGEON';
        submitBtn.style.background = '';
        submitBtn.style.boxShadow = '';
        submitBtn.disabled = false;
      }, 3500);
    }
  });
})();


/* ============================================================
   9. CURSOR PIXEL TRAIL
   ============================================================ */
(function initCursorTrail() {
  const trail = document.createElement('div');
  trail.style.cssText = `
    position:fixed; width:8px; height:8px;
    background:var(--accent-pink);
    pointer-events:none; z-index:9999;
    image-rendering:pixelated;
    box-shadow:0 0 12px var(--accent-pink), 0 0 24px rgba(255,45,120,0.35);
    transform:translate(-50%,-50%);
    transition:opacity 0.2s;
  `;
  document.body.appendChild(trail);
  let mx = -100, my = -100, tx = -100, ty = -100;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  (function animTrail() {
    tx += (mx - tx) * 0.14;
    ty += (my - ty) * 0.14;
    trail.style.left = `${tx}px`;
    trail.style.top = `${ty}px`;
    requestAnimationFrame(animTrail);
  })();
})();


/* ============================================================
   10. PHOTO GALLERY PLACEHOLDER — click to "upload"
   ============================================================ */
(function initGalleryPlaceholders() {
  document.querySelectorAll('.placeholder-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      // In production, trigger a real file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        slot.innerHTML = '';
        if (file.type.startsWith('video/')) {
          const vid = document.createElement('video');
          vid.src = url;
          vid.controls = true;
          vid.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          slot.appendChild(vid);
        } else {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Event photo';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:4px;';
          slot.appendChild(img);
        }
        slot.classList.remove('placeholder-slot');
      });
      input.click();
    });
    slot.title = 'Click to add photo or video';
  });
})();


/* ============================================================
   11. KONAMI CODE EASTER EGG
   ============================================================ */
(function initKonami() {
  const SEQ = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
  let pos = 0;
  document.addEventListener('keydown', e => {
    pos = (e.keyCode === SEQ[pos]) ? pos + 1 : 0;
    if (pos === SEQ.length) {
      pos = 0;
      document.body.style.filter = 'hue-rotate(180deg)';
      setTimeout(() => document.body.style.filter = '', 3000);
      const toast = document.getElementById('toast');
      if (toast) {
        const msg = toast.querySelector('.toast-msg');
        if (msg) msg.textContent = '🎮 CHEAT CODE ACTIVATED! HUE SHIFT!';
        toast.classList.add('show');
        setTimeout(() => {
          toast.classList.remove('show');
          if (msg) msg.textContent = 'INVITE SENT! WE\'LL BE IN TOUCH SOON.';
        }, 3500);
      }
    }
  });
})();
