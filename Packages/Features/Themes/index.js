!(function () {
  const theme = localStorage.getItem('ow-theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
