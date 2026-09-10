(() => {
  const script = document.currentScript;
  if (!script) return;
  const slug = script.dataset.org;
  const assistantKey = script.dataset.assistantKey;
  if (!slug || !assistantKey) return;

  const appOrigin = new URL(script.src, window.location.href).origin;
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Open campus assistant');
  button.textContent = 'Ask us';
  Object.assign(button.style, {
    position: 'fixed', right: '24px', bottom: '24px', zIndex: '2147483646', border: '0', borderRadius: '999px',
    padding: '13px 18px', background: '#4f46e5', color: '#fff', font: '600 14px system-ui, sans-serif', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.2)',
  });

  const frame = document.createElement('iframe');
  frame.title = 'Campus assistant';
  frame.src = `${appOrigin}/chat/${encodeURIComponent(slug)}?key=${encodeURIComponent(assistantKey)}`;
  Object.assign(frame.style, {
    position: 'fixed', right: '24px', bottom: '82px', width: 'min(380px, calc(100vw - 32px))', height: 'min(600px, calc(100vh - 112px))',
    zIndex: '2147483646', border: '0', borderRadius: '16px', boxShadow: '0 12px 36px rgba(0,0,0,.24)', display: 'none', background: '#fff',
  });
  button.addEventListener('click', () => {
    const opening = frame.style.display === 'none';
    frame.style.display = opening ? 'block' : 'none';
    button.textContent = opening ? 'Close' : 'Ask us';
  });
  document.body.append(frame, button);
})();
