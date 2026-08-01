const darkIcon = document.getElementById("theme-toggle-dark-icon");
const lightIcon = document.getElementById("theme-toggle-light-icon");
const toggleButton = document.getElementById("theme-toggle");

if (darkIcon && lightIcon && toggleButton) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const savedTheme = localStorage.getItem("color-theme");
  const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);

  (isDark ? lightIcon : darkIcon).classList.remove("hidden");
  toggleButton.setAttribute("aria-pressed", String(isDark));

  toggleButton.addEventListener("click", () => {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);
    darkIcon.classList.toggle("hidden", nextIsDark);
    lightIcon.classList.toggle("hidden", !nextIsDark);
    toggleButton.setAttribute("aria-pressed", String(nextIsDark));
    localStorage.setItem("color-theme", nextIsDark ? "dark" : "light");
  });
}
