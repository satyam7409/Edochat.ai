(() => {
  const script = document.currentScript;
  if (!script) return;
  const slug = script.dataset.org;
  const assistantKey = script.dataset.assistantKey;
  if (!slug || !assistantKey) return;
  if (document.querySelector('[data-educhat-widget]')) return;

  const appOrigin = new URL(script.src, window.location.href).origin;
  const button = document.createElement('button');
  button.dataset.educhatWidget = 'button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open campus assistant');
  button.textContent = 'Ask us';
  Object.assign(button.style, {
    position: 'fixed', right: '24px', bottom: '24px', zIndex: '2147483646', border: '0', borderRadius: '999px',
    padding: '13px 18px', background: '#0f172a', color: '#fff', font: '600 14px system-ui, sans-serif', cursor: 'pointer', boxShadow: '0 8px 24px rgba(15,23,42,.24)',
  });

  const frame = document.createElement('iframe');
  frame.dataset.educhatWidget = 'frame';
  frame.title = 'Campus assistant';
  frame.src = `${appOrigin}/chat/${encodeURIComponent(slug)}?key=${encodeURIComponent(assistantKey)}`;
  Object.assign(frame.style, {
    position: 'fixed', right: '24px', bottom: '82px', width: 'min(420px, calc(100vw - 32px))', height: 'min(680px, calc(100vh - 112px))',
    zIndex: '2147483646', border: '0', borderRadius: '16px', boxShadow: '0 12px 36px rgba(0,0,0,.24)', display: 'none', background: '#fff',
  });
  window.addEventListener('resize', () => {
    frame.style.right = window.innerWidth < 520 ? '16px' : '24px';
    frame.style.bottom = window.innerWidth < 520 ? '76px' : '82px';
    button.style.right = window.innerWidth < 520 ? '16px' : '24px';
    button.style.bottom = window.innerWidth < 520 ? '18px' : '24px';
  });
  button.addEventListener('click', () => {
    const opening = frame.style.display === 'none';
    frame.style.display = opening ? 'block' : 'none';
    button.textContent = opening ? 'Close' : 'Ask us';
  });
  document.body.append(frame, button);
})();
