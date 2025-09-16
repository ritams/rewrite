// Function to get API key from storage
async function getApiKey() {
  const result = await chrome.storage.sync.get(['geminiApiKey']);
  if (!result.geminiApiKey) {
    throw new Error('No API key found. Please set your Gemini API key in the extension popup.');
  }
  return result.geminiApiKey;
}

// Debounce function to limit frequent calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// (Removed old per-input floating button logic)

// Function to rewrite text using Gemini API
async function rewriteText(text) {
  const apiKey = await getApiKey();
  const prompt = `Only rewite the sentences which contains bad words don't change the meaning of the text: ${text} don't add anything else.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  });
  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Harden parsing across response variants
  const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text
           || data?.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data
           || data?.candidates?.[0]?.content?.parts?.[0]?.payload?.text
           || '';
  if (!resultText) throw new Error('Empty response from model');
  return String(resultText).trim();
}

// Handle inputs (disabled in minimal mode)
function initInput(input) {
  // Minimal mode: old per-input logic disabled
  return;
}

// Minimal mode: do nothing
function init() {}

init();

// Minimal mode: single persistent floating button attached to focused text input/contenteditable
(() => {
  let isBusy = false;
  const isTextLike = (el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.matches('textarea')) return true;
    // any contenteditable except explicit false
    if (el.matches('[contenteditable]:not([contenteditable="false"])')) return true;
    if (el.matches('input')) {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      // Allow common text-like inputs
      return ['text','search','email','url','tel','password','number'].includes(t);
    }
    return false;
  };

  // Create singleton button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Rewrite';
  Object.assign(btn.style, {
    position: 'fixed',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    zIndex: '2147483647',
    fontSize: '12px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'opacity .15s ease, transform .15s ease',
    opacity: '0',
    pointerEvents: 'none'
  });
  document.documentElement.appendChild(btn);

  let currentTarget = null;

  const positionButton = () => {
    if (!currentTarget || !document.contains(currentTarget)) return hideButton();
    const rect = currentTarget.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const top = rect.top + scrollY + (rect.height - btn.offsetHeight) / 2;
    const left = rect.right + scrollX + 8;
    btn.style.top = `${Math.max(8, top)}px`;
    btn.style.left = `${left}px`;
  };

  const showButton = (target) => {
    currentTarget = target;
    positionButton();
    btn.style.opacity = '1';
    btn.style.transform = 'translateY(0)';
    btn.style.pointerEvents = 'auto';
  };

  const hideButton = () => {
    btn.style.opacity = '0';
    btn.style.transform = 'translateY(-4px)';
    btn.style.pointerEvents = 'none';
    currentTarget = null;
  };

  // Reposition on scroll/resize and when layout may change
  const debouncedReposition = debounce(positionButton, 50);
  window.addEventListener('scroll', debouncedReposition, true);
  window.addEventListener('resize', debouncedReposition);

  // Focus handling: attach to focused text-like element, otherwise hide
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    // Ignore focus changes to the button itself
    if (t === btn) return;
    // While busy, do not change target or hide the button
    if (isBusy) return;
    if (isTextLike(t)) {
      showButton(t);
    } else {
      hideButton();
    }
  });

  // Keep following the caret as user types (reposition only)
  document.addEventListener('input', () => {
    if (currentTarget) debouncedReposition();
  }, true);

  // Prevent the button from stealing focus (keeps currentTarget valid)
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  // Click handler: send full content to LLM and replace
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentTarget) return;

    // Keep button anchored to current target during operation
    isBusy = true;
    showButton(currentTarget);
    positionButton();

    const getText = (el) => (
      el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'
        ? el.value
        : (el.innerText ?? el.textContent ?? '')
    );
    const setText = (el, txt) => {
      const wasContentEditable = !(el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
      if (!wasContentEditable) el.value = txt; else el.textContent = txt;
      // Fire events so frameworks detect the change
      try {
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      } catch {}
      try {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {}
      // Restore focus
      try { el.focus({ preventScroll: true }); } catch {}
      debouncedReposition();
    };

    const original = (getText(currentTarget) || '').trim();
    if (!original) return;

    btn.textContent = 'Rewriting…';
    btn.disabled = true;

    try {
      const rewritten = await rewriteText(original);
      setText(currentTarget, rewritten);
      btn.textContent = 'Rewrite';
    } catch (err) {
      console.error('Rewrite failed:', err);
      btn.textContent = 'Error';
      btn.title = (err && err.message) ? String(err.message) : 'Rewrite failed';
      setTimeout(() => { if (currentTarget) btn.textContent = 'Rewrite'; }, 1200);
    } finally {
      btn.title = '';
      btn.disabled = false;
      debouncedReposition();
      isBusy = false;
    }
  });
})();