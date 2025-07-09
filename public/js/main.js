(() => {
  // <stdin>
  var themeSwitcher;
  document.addEventListener("DOMContentLoaded", () => {
    themeSwitcher = document.getElementById("theme-switcher");
    if (themeSwitcher !== void 0) {
      if (localStorage.getItem("mode") === "true") {
        themeSwitcher.checked = true;
      }
      themeSwitcher.addEventListener("click", () => {
        localStorage.setItem("mode", themeSwitcher.checked);
      });
    }
  });
})();
