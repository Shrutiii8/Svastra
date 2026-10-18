/**
 * Svastra (HeatGuard Twin) — Interactive Web Application
 * Handles theme switching, mobile drawer navigation, real-time Digital Twin
 * telemetry simulation engine, contact validation, and accessible modals.
 */

(function () {
  'use strict';

  // ============================================================================
  // 1. THEME SWITCHER (Dark / Light)
  // ============================================================================
  const themeToggles = document.querySelectorAll('.theme-toggle-btn, #themeToggle');
  const htmlRoot = document.documentElement;

  function getPreferredTheme() {
    const saved = localStorage.getItem('svastra-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    htmlRoot.setAttribute('data-theme', theme);
    localStorage.setItem('svastra-theme', theme);
  }

  // Initialize theme
  applyTheme(getPreferredTheme());

  themeToggles.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = htmlRoot.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  });

  // ============================================================================
  // 2. MOBILE DRAWER NAVIGATION
  // ============================================================================
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link, .drawer-brand');

  function openMobileMenu() {
    if (mobileToggle) {
      mobileToggle.classList.add('active');
      mobileToggle.setAttribute('aria-expanded', 'true');
    }
    if (mobileDrawer) {
      mobileDrawer.classList.add('open');
      mobileDrawer.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    if (mobileToggle) {
      mobileToggle.classList.remove('active');
      mobileToggle.setAttribute('aria-expanded', 'false');
    }
    if (mobileDrawer) {
      mobileDrawer.classList.remove('open');
      mobileDrawer.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = mobileDrawer.classList.contains('open');
      isOpen ? closeMobileMenu() : openMobileMenu();
    });

    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMobileMenu();
      });
    }

    mobileNavLinks.forEach((link) => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });

    // Don't close when tapping inside drawer content
    mobileDrawer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (
        mobileDrawer.classList.contains('open') &&
        !mobileDrawer.contains(e.target) &&
        !mobileToggle.contains(e.target)
      ) {
        closeMobileMenu();
      }
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('open')) {
        closeMobileMenu();
      }
    });
  }

  // ============================================================================
  // 3. INTERACTIVE DIGITAL TWIN SIMULATION ENGINE
  // ============================================================================
  const tempSlider = document.getElementById('tempSlider');
  const hrSlider = document.getElementById('hrSlider');
  const baselineSlider = document.getElementById('baselineSlider');

  const tempValue = document.getElementById('tempValue');
  const hrValue = document.getElementById('hrValue');
  const baselineValue = document.getElementById('baselineValue');

  const simStatusBadge = document.getElementById('simStatusBadge');
  const simStatusText = document.getElementById('simStatusText');
  const simGaugeCircle = document.getElementById('simGaugeCircle');
  const simStrainScore = document.getElementById('simStrainScore');
  const simStrainLabel = document.getElementById('simStrainLabel');
  const simHrDiff = document.getElementById('simHrDiff');
  const simTempStatus = document.getElementById('simTempStatus');
  const simRuleTrigger = document.getElementById('simRuleTrigger');
  const simActionBox = document.getElementById('simActionBox');
  const simActionText = document.getElementById('simActionText');

  const presetButtons = document.querySelectorAll('[data-preset]');

  // Circle circumference: 2 * Math.PI * 70 ≈ 439.82
  const GAUGE_CIRCUMFERENCE = 439.82;

  function updateSimulation() {
    if (!tempSlider || !hrSlider || !baselineSlider) return;

    const ambientTemp = parseFloat(tempSlider.value);
    const heartRate = parseInt(hrSlider.value, 10);
    const baselineHr = parseInt(baselineSlider.value, 10);

    // Update label text
    tempValue.textContent = `${ambientTemp.toFixed(1)} °C`;
    hrValue.textContent = `${heartRate} BPM`;
    baselineValue.textContent = `${baselineHr} BPM`;

    const deltaHr = heartRate - baselineHr;
    const sign = deltaHr >= 0 ? '+' : '';
    simHrDiff.textContent = `${sign}${deltaHr} BPM vs baseline (${baselineHr})`;

    // Environmental label
    if (ambientTemp >= 40) {
      simTempStatus.textContent = `Extreme Heat Wave (${ambientTemp.toFixed(1)}°C ≥ 40°C)`;
    } else if (ambientTemp >= 36) {
      simTempStatus.textContent = `High Heat Stress (${ambientTemp.toFixed(1)}°C)`;
    } else {
      simTempStatus.textContent = `Moderate Heat (${ambientTemp.toFixed(1)}°C)`;
    }

    // Physiological Strain Index calculation (Scaled 0-100)
    // Formula mirrors physiological strain + heat delta
    let rawScore = Math.round(
      ((heartRate - baselineHr) / 60) * 60 +
      ((ambientTemp - 26) / 22) * 40
    );
    rawScore = Math.max(10, Math.min(99, rawScore));

    // Rule-Based Engine Evaluation (Matches backend app/services/assessment.py)
    let verdict = 'normal';
    let rule = '';
    let recommendation = '';
    let badgeClass = 'status-normal';
    let statusTitle = 'Normal Condition';
    let strokeColor = '#3DDC84';

    if (deltaHr >= 40) {
      verdict = 'supervisor_review';
      badgeClass = 'status-review';
      statusTitle = 'Supervisor Review Needed';
      strokeColor = '#FF6B6B';
      rule = `HR (${heartRate}) > Baseline (${baselineHr}) + 40 bpm`;
      recommendation = 'Immediate supervisor intervention required. Remove worker to shaded recovery station, provide cool electrolyte water, and monitor heart rate decay for 15 minutes.';
      rawScore = Math.max(75, rawScore);
    } else if (deltaHr >= 20) {
      verdict = 'monitor';
      badgeClass = 'status-monitor';
      statusTitle = 'Elevated Strain (Monitor)';
      strokeColor = '#F59E0B';
      rule = `HR (${heartRate}) > Baseline (${baselineHr}) + 20 bpm`;
      recommendation = 'Elevated cardiovascular workload detected. Advise mandatory 10-minute shaded rest, electrolyte rehydration, and re-check vitals.';
      rawScore = Math.max(50, Math.min(74, rawScore));
    } else if (ambientTemp >= 40.0) {
      // Environmental escalation modifier
      verdict = 'monitor';
      badgeClass = 'status-monitor';
      statusTitle = 'Monitor (Ambient Heat ≥ 40°C)';
      strokeColor = '#F59E0B';
      rule = `Environmental Escalation: Ambient Temp (${ambientTemp}°C) ≥ 40°C`;
      recommendation = 'Workload normal, but extreme external heat warrants active hydration vigilance and scheduled rotation to shaded cooling zones.';
      rawScore = Math.max(52, Math.min(70, rawScore));
    } else {
      verdict = 'normal';
      badgeClass = 'status-normal';
      statusTitle = 'No Unusual Pattern';
      strokeColor = '#3DDC84';
      rule = `Within personal baseline envelope (Δ = ${sign}${deltaHr} bpm)`;
      recommendation = 'Biometrics within individual normal tolerance threshold. Maintain regular 45-minute hydration cadence and standard shift rotation.';
      rawScore = Math.min(48, rawScore);
    }

    // Update UI elements
    simStatusBadge.className = `status-badge ${badgeClass}`;
    simStatusText.textContent = statusTitle;
    simStrainScore.innerHTML = `${rawScore}<small>%</small>`;
    simRuleTrigger.textContent = rule;
    simActionText.textContent = recommendation;

    if (verdict === 'supervisor_review') {
      simStrainLabel.textContent = 'Severe Strain';
      simStrainLabel.className = 'gauge-sub text-danger';
      simActionBox.style.borderColor = 'rgba(255, 107, 107, 0.4)';
    } else if (verdict === 'monitor') {
      simStrainLabel.textContent = 'Moderate Strain';
      simStrainLabel.className = 'gauge-sub text-warning';
      simActionBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    } else {
      simStrainLabel.textContent = 'Healthy Tolerance';
      simStrainLabel.className = 'gauge-sub text-positive';
      simActionBox.style.borderColor = 'rgba(61, 220, 132, 0.4)';
    }

    // Update circular SVG gauge
    if (simGaugeCircle) {
      const offset = GAUGE_CIRCUMFERENCE - (rawScore / 100) * GAUGE_CIRCUMFERENCE;
      simGaugeCircle.style.strokeDashoffset = offset;
      simGaugeCircle.style.stroke = strokeColor;
    }
  }

  // Presets definition
  const presets = {
    review: { temp: 42.0, hr: 122, baseline: 72 },
    monitor: { temp: 37.5, hr: 98, baseline: 72 },
    normal: { temp: 31.0, hr: 76, baseline: 74 },
    'extreme-weather': { temp: 43.5, hr: 80, baseline: 72 }
  };

  if (tempSlider && hrSlider && baselineSlider) {
    [tempSlider, hrSlider, baselineSlider].forEach((slider) => {
      slider.addEventListener('input', () => {
        // Clear active preset button on manual slider interaction
        presetButtons.forEach((btn) => btn.classList.remove('active'));
        updateSimulation();
      });
    });

    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-preset');
        if (presets[key]) {
          presetButtons.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');

          tempSlider.value = presets[key].temp;
          hrSlider.value = presets[key].hr;
          baselineSlider.value = presets[key].baseline;

          updateSimulation();
        }
      });
    });

    // Initial simulation run
    updateSimulation();
  }

  // ============================================================================
  // 4. CONTACT FORM VALIDATION & REAL EMAIL SUBMISSION
  // ============================================================================
  const contactForm = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitContactBtn');
  const modal = document.getElementById('contactSuccessModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalUserName = document.getElementById('modalUserName');
  const modalUserEmail = document.getElementById('modalUserEmail');
  const modalMailtoBtn = document.getElementById('modalMailtoBtn');

  const TARGET_EMAIL = 'iambeinganupam@gmail.com';
  const DISPLAY_EMAIL = 'contact@svastra.com';

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateField(fieldId, errorId, condition) {
    const field = document.getElementById(fieldId);
    const group = field ? field.closest('.form-group') : null;
    if (!group) return true;

    if (!condition) {
      group.classList.add('has-error');
      return false;
    } else {
      group.classList.remove('has-error');
      return true;
    }
  }

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullName = document.getElementById('fullName').value.trim();
      const emailAddr = document.getElementById('emailAddr').value.trim();
      const orgName = document.getElementById('orgName') ? document.getElementById('orgName').value.trim() : '';
      const sectorSelect = document.getElementById('sectorSelect').value;
      const inquirySubject = document.getElementById('inquirySubject').value.trim();
      const messageText = document.getElementById('messageText').value.trim();
      const consentCheck = document.getElementById('consentCheck').checked;

      // Validation flags
      const isNameValid = validateField('fullName', 'nameError', fullName.length >= 2);
      const isEmailValid = validateField('emailAddr', 'emailError', validateEmail(emailAddr));
      const isSectorValid = validateField('sectorSelect', 'sectorError', sectorSelect !== '');
      const isSubjectValid = validateField('inquirySubject', 'subjectError', inquirySubject.length >= 5);
      const isMsgValid = validateField('messageText', 'messageError', messageText.length >= 15);
      const isConsentValid = validateField('consentCheck', 'consentError', consentCheck);

      if (!isNameValid || !isEmailValid || !isSectorValid || !isSubjectValid || !isMsgValid || !isConsentValid) {
        return;
      }

      // Show loading on submit button
      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spin-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Transmitting to ${DISPLAY_EMAIL}...</span>
      `;

      // Build transmission payload
      const payload = {
        name: fullName,
        email: emailAddr,
        organization: orgName || 'Not specified',
        sector: sectorSelect,
        subject: inquirySubject,
        message: messageText,
        _subject: `[Svastra Inquiry] ${inquirySubject} — ${fullName}`,
        _replyto: emailAddr,
        _template: 'table',
        _captcha: 'false'
      };

      // Prepare instant mailto backup
      const mailtoBody = encodeURIComponent(
        `From: ${fullName} (${emailAddr})\n` +
        `Organization: ${orgName || 'Not specified'}\n` +
        `Industry Sector: ${sectorSelect}\n` +
        `Subject: ${inquirySubject}\n\n` +
        `Message Details:\n${messageText}`
      );
      const mailtoUrl = `mailto:${TARGET_EMAIL}?subject=${encodeURIComponent(`[Svastra Pilot Inquiry] ${inquirySubject}`)}&body=${mailtoBody}`;
      if (modalMailtoBtn) {
        modalMailtoBtn.href = mailtoUrl;
      }

      // Execute actual email dispatch
      let dispatched = false;
      try {
        // Attempt 1: Svastra Web Vercel Serverless Function (/api/contact)
        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              fullName,
              emailAddr,
              orgName,
              sectorSelect,
              inquirySubject,
              messageText
            })
          });

          if (res.ok) {
            dispatched = true;
            const data = await res.json().catch(() => ({}));
            console.log('Dispatched via Svastra Vercel API:', data);
          } else {
            console.warn('Vercel API returned non-OK status:', res.status);
          }
        } catch (apiErr) {
          console.warn('Vercel /api/contact route error:', apiErr);
        }

        // Attempt 2: FormSubmit AJAX Fallback (if running without serverless function)
        if (!dispatched) {
          try {
            const res = await fetch(`https://formsubmit.co/ajax/${TARGET_EMAIL}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            console.log('Dispatched via FormSubmit:', data);
          } catch (netErr) {
            console.warn('FormSubmit notification fallback:', netErr);
          }
        }
      } finally {
        // Restore submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;

        // Populate modal data
        if (modalUserName) modalUserName.textContent = fullName;
        if (modalUserEmail) modalUserEmail.textContent = emailAddr;

        // Open confirmation modal
        if (modal) {
          modal.classList.add('open');
          modal.setAttribute('aria-hidden', 'false');
          document.body.style.overflow = 'hidden';
        }

        contactForm.reset();
        document.querySelectorAll('.form-group').forEach((g) => g.classList.remove('has-error'));
      }
    });
  }

  // Modal close handlers
  function closeModal() {
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
    });
  }

  // ============================================================================
  // 5. ACTIVE NAVIGATION SPY ON SCROLL
  // ============================================================================
  const sections = document.querySelectorAll('main > section[id]');
  const desktopNavLinks = document.querySelectorAll('.nav-menu .nav-link');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    desktopNavLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  });
})();
