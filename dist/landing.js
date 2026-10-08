"use strict";

(() => {
  const hero = document.querySelector(".hero-section");
  const content = document.querySelector(".main-content");
  const header = document.querySelector(".topbar");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!hero || !content) return;

  let phase = "ready";
  let revealTimer;
  let finishTimer;
  const atLanding = (!location.hash || location.hash === "#top") && window.scrollY < 10;
  document.body.classList.add("landing-enhanced");

  function finishEntrance() {
    clearTimeout(revealTimer);
    clearTimeout(finishTimer);
    phase = "ready";
    document.body.classList.remove("landing-view", "landing-departing", "landing-content-visible");
    document.body.classList.add("landing-complete");
    content.inert = false;
    header.inert = false;
    hero.hidden = true;
    document.getElementById("introTitle").focus({ preventScroll: true });
    window.dispatchEvent(new Event("resize"));
  }

  function enterContent() {
    if (phase !== "waiting") return;
    phase = "departing";
    document.body.classList.add("landing-departing");
    hero.querySelector("button").disabled = true;
    revealTimer = setTimeout(() => {
      document.body.classList.add("landing-content-visible");
      document.body.classList.remove("landing-view");
    }, reducedMotion.matches ? 1500 : 2400);
    finishTimer = setTimeout(finishEntrance, reducedMotion.matches ? 1800 : 4000);
  }

  if (atLanding) {
    phase = "waiting";
    document.body.classList.add("landing-view");
    content.inert = true;
    header.inert = true;
  } else {
    document.body.classList.add("landing-complete");
    hero.hidden = true;
  }

  // Only Get Started opens the content; block scroll gestures until it finishes.
  window.addEventListener("wheel", (event) => {
    if (phase === "ready" || event.ctrlKey) return;
    event.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", (event) => {
    if (phase === "ready" || event.touches.length !== 1) return;
    event.preventDefault();
  }, { passive: false });
  window.addEventListener("keydown", (event) => {
    if (phase === "ready" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target === hero.querySelector("button") && [" ", "Enter"].includes(event.key)) return;
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"].includes(event.key)) {
      event.preventDefault();
    }
  });
  hero.querySelector("button").addEventListener("click", enterContent);
  window.addEventListener("hashchange", () => {
    if (phase !== "ready" && location.hash && location.hash !== "#top") finishEntrance();
  });
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches && phase === "departing") finishEntrance();
  });

  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
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
