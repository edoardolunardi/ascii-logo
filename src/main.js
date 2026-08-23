// Entry point: register the element, wire the theme switch.

import { AsciiLogoElement } from "./ascii-logo/element.js";

if (!customElements.get("ascii-logo")) {
  customElements.define("ascii-logo", AsciiLogoElement);
}

const choices = document.querySelectorAll("[data-theme-choice]");

function applyTheme(dark) {
  // Page first, element second: the element re-reads its computed ink when its own attribute
  // flips, so the cascade has to already be on the new theme by then.
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  for (const logo of document.querySelectorAll("ascii-logo")) {
    logo.toggleAttribute("dark", dark);
  }

  for (const choice of choices) {
    choice.setAttribute("aria-pressed", String((choice.dataset.themeChoice === "dark") === dark));
  }
}

for (const choice of choices) {
  choice.addEventListener("click", () => applyTheme(choice.dataset.themeChoice === "dark"));
}
