// Applies the saved light/dark theme before first paint. A file, not an inline script, so the
// Content-Security-Policy can stay at script-src 'self'.
(function () {
  var mode = 'light';
  try {
    var saved = localStorage.getItem('locker-theme');
    if (saved === 'dark' || saved === 'light') mode = saved;
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', mode);
})();
