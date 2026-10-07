"use strict";

(() => {
  const hero = document.querySelector(".hero-section");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!hero || !("IntersectionObserver" in window)) return;

  // The full navigation returns as the viewer reaches the content below the scene.
  const navigationObserver = new IntersectionObserver(([entry]) => {
    document.body.classList.toggle("landing-view", entry.isIntersecting);
  }, { threshold: 0, rootMargin: "-110px 0px 0px 0px" });
  if (hero.getBoundingClientRect().bottom > 110) document.body.classList.add("landing-view");
  navigationObserver.observe(hero);

  if (reducedMotion.matches) return;
  const elements = document.querySelectorAll(
    ".landing-brand, .landing-manifesto, .flight-intro h2, " +
    ".flight-intro .section-kicker, .intro-detail, .mission-copy, .mission-grid article, " +
    ".platform-copy, .platform-stack, .analysis-heading, .section-header, .insights-section > div:first-child"
  );
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  elements.forEach((element) => {
    element.classList.add("reveal-text");
    revealObserver.observe(element);
  });
  reducedMotion.addEventListener("change", (event) => {
    if (!event.matches) return;
    elements.forEach((element) => element.classList.add("is-revealed"));
    revealObserver.disconnect();
  });
})();
