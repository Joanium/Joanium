(function() {
  const theme = localStorage.getItem('ow-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();
