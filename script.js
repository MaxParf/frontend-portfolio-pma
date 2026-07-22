import { renderProjects } from "./components/project-renderer.js";
import { projects } from "./data/projects.js";

const CMS_LOGIN_URL = "http://127.0.0.1:5510/login";

document.addEventListener("DOMContentLoaded", () => {
  const projectsRoot = document.querySelector("[data-projects-root]");
  const burger = document.querySelector(".site-header__burger");
  const navigation = document.getElementById("site-navigation");
  const body = document.body;
  const scrollBtn = document.getElementById("scrollToTop");
  const heroSection = document.getElementById("hero");
  const lightbox = document.getElementById("projectLightbox");
  const lightboxImage = lightbox?.querySelector(".lightbox__image");
  const lightboxCaption = lightbox?.querySelector("[data-lightbox-caption]");
  const lightboxClose = lightbox?.querySelector("[data-lightbox-close]");
  const lightboxPrev = lightbox?.querySelector("[data-lightbox-prev]");
  const lightboxNext = lightbox?.querySelector("[data-lightbox-next]");
  let activeGalleryName = null;
  let activeGalleryIndex = 0;
  let lastFocusedGalleryButton = null;

  function getCurrentLocale() {
    return window.getCurrentLanguage?.() || document.documentElement.lang || "en";
  }

  function renderProjectCards(locale = getCurrentLocale()) {
    renderProjects({
      root: projectsRoot,
      projects,
      locale,
    });
  }

  function getGalleries() {
    const galleryButtons = Array.from(document.querySelectorAll("[data-gallery]"));

    const galleries = galleryButtons.reduce((acc, button) => {
      const galleryName = button.dataset.gallery;

      if (!galleryName) {
        return acc;
      }

      if (!acc[galleryName]) {
        acc[galleryName] = [];
      }

      acc[galleryName].push(button);
      return acc;
    }, {});

    Object.values(galleries).forEach((gallery) => {
      gallery.sort((first, second) => Number(first.dataset.galleryIndex) - Number(second.dataset.galleryIndex));
    });

    return galleries;
  }

  renderProjectCards();

  window.addEventListener("languagechange", (event) => {
    renderProjectCards(event.detail?.lang);

    if (lightbox?.classList.contains("is-open")) {
      renderLightboxImage();
    }
  });

  if (burger && navigation) {
    burger.addEventListener("click", () => {
      const isOpen = burger.getAttribute("aria-expanded") === "true";

      burger.setAttribute("aria-expanded", String(!isOpen));
      burger.classList.toggle("is-active", !isOpen);
      navigation.classList.toggle("is-open", !isOpen);
      body.classList.toggle("lock", !isOpen);
    });

    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        burger.setAttribute("aria-expanded", "false");
        burger.classList.remove("is-active");
        navigation.classList.remove("is-open");
        body.classList.remove("lock");
      });
    });
  }

  if (scrollBtn && heroSection) {
    window.addEventListener("scroll", () => {
      scrollBtn.style.display = window.scrollY > heroSection.offsetHeight ? "flex" : "none";
    });

    scrollBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }

  function renderLightboxImage() {
    const galleries = getGalleries();
    const gallery = galleries[activeGalleryName] || [];
    const activeButton = gallery[activeGalleryIndex];
    const activeImage = activeButton?.querySelector("img");

    if (!activeImage || !lightboxImage || !lightboxCaption || !lightboxPrev || !lightboxNext) {
      return;
    }

    lightboxImage.src = activeImage.currentSrc || activeImage.src;
    lightboxImage.alt = activeImage.alt;
    lightboxCaption.textContent = activeImage.alt;

    const hasMultipleImages = gallery.length > 1;
    lightboxPrev.hidden = !hasMultipleImages;
    lightboxNext.hidden = !hasMultipleImages;
  }

  function openLightbox(galleryName, galleryIndex, triggerButton) {
    const galleries = getGalleries();

    if (!lightbox || !galleries[galleryName]) {
      return;
    }

    activeGalleryName = galleryName;
    activeGalleryIndex = galleryIndex;
    lastFocusedGalleryButton = triggerButton;
    renderLightboxImage();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    body.classList.add("lightbox-open");
    lightboxClose?.focus();
  }

  function closeLightbox() {
    if (!lightbox) {
      return;
    }

    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    body.classList.remove("lightbox-open");

    if (lightboxImage) {
      lightboxImage.removeAttribute("src");
      lightboxImage.alt = "";
    }

    lastFocusedGalleryButton?.focus();
    activeGalleryName = null;
    activeGalleryIndex = 0;
  }

  function showAdjacentImage(direction) {
    const galleries = getGalleries();
    const gallery = galleries[activeGalleryName] || [];

    if (gallery.length <= 1) {
      return;
    }

    activeGalleryIndex = (activeGalleryIndex + direction + gallery.length) % gallery.length;
    renderLightboxImage();
  }

  function getFocusableLightboxElements() {
    if (!lightbox) {
      return [];
    }

    return Array.from(
      lightbox.querySelectorAll(
        'button:not([disabled]):not([hidden]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null || element === document.activeElement);
  }

  function trapLightboxFocus(event) {
    const focusableElements = getFocusableLightboxElements();

    if (!focusableElements.length) {
      event.preventDefault();
      lightbox?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!lightbox.contains(document.activeElement)) {
      event.preventDefault();
      firstElement.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const galleryButton = event.target.closest("[data-gallery]");

    if (!galleryButton) {
      return;
    }

    openLightbox(galleryButton.dataset.gallery, Number(galleryButton.dataset.galleryIndex), galleryButton);
  });

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", () => showAdjacentImage(-1));
  lightboxNext?.addEventListener("click", () => showAdjacentImage(1));

  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    const activeElement = document.activeElement;
    const isEditableTarget =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      activeElement?.getAttribute("contenteditable") === "true";

    if (event.ctrlKey && event.shiftKey && event.key === "F12" && !isEditableTarget) {
      window.open(CMS_LOGIN_URL, "_blank", "noopener,noreferrer");
      return;
    }

    if (!lightbox?.classList.contains("is-open")) {
      return;
    }

    if (event.key === "Tab") {
      trapLightboxFocus(event);
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "ArrowLeft") {
      showAdjacentImage(-1);
    }

    if (event.key === "ArrowRight") {
      showAdjacentImage(1);
    }
  });
});
