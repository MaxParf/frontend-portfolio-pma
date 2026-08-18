import { renderProjects } from "./components/project-renderer.js";
import { ProjectSourceError, loadProjectState } from "./services/projects-source.js";

const CMS_LOGIN_URL = globalThis.__PORTFOLIO_CONFIG__?.cmsLoginUrl;

document.addEventListener("DOMContentLoaded", () => {
  const projectsRoot = document.querySelector("[data-projects-root]");
  const projectsStatus = document.querySelector("[data-projects-status]");
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
  let projectRequestController = null;
  let projectRequestSequence = 0;
  let activeProjectSource = null;

  function getCurrentLocale() {
    return window.getCurrentLanguage?.() || document.documentElement.lang || "en";
  }

  function renderProjectCards(projects, locale) {
    return renderProjects({
      root: projectsRoot,
      projects,
      locale,
    });
  }

  function setProjectsStatus(locale, status) {
    if (projectsRoot) {
      projectsRoot.setAttribute("aria-busy", String(status === "loading"));
    }

    if (projectsStatus) {
      projectsStatus.textContent = status === "loading"
        ? (locale === "ru" ? "Загрузка проектов…" : "Loading projects…")
        : status === "error"
          ? (locale === "ru" ? "Не удалось загрузить проекты." : "Projects could not be loaded.")
          : (locale === "ru" ? "Проекты загружены." : "Projects loaded.");
    }
  }

  async function loadAndRenderProjects(locale = getCurrentLocale()) {
    projectRequestController?.abort();
    const requestController = new AbortController();
    const requestSequence = ++projectRequestSequence;
    projectRequestController = requestController;
    setProjectsStatus(locale, "loading");

    try {
      const result = await loadProjectState({ signal: requestController.signal });
      if (requestSequence !== projectRequestSequence) {
        result.dispose?.();
        return;
      }

      if (lightbox?.classList.contains("is-open")) {
        closeLightbox();
      }

      activeProjectSource?.dispose?.();
      activeProjectSource = result;
      const renderedProjects = renderProjectCards(result.projects, locale);
      document.documentElement.dataset.projectsSource = result.source;
      window.dispatchEvent(new CustomEvent("portfolio:projects-loaded", { detail: { source: result.source, count: renderedProjects.length, locale } }));
      setProjectsStatus(locale, "ready");
    } catch (error) {
      if (!(error instanceof ProjectSourceError) || error.kind !== "aborted") {
        console.warn("[portfolio] Project loading did not complete.");
        if (projectsRoot) {
          const message = document.createElement("p");
          message.className = "projects-load-error";
          message.setAttribute("role", "alert");
          message.textContent = locale === "ru" ? "Не удалось загрузить проекты. Обновите страницу позже." : "Projects could not be loaded. Please try again later.";
          projectsRoot.replaceChildren(message);
        }
        document.documentElement.dataset.projectsSource = "error";
        setProjectsStatus(locale, "error");
      }
    }
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

  void loadAndRenderProjects();

  window.addEventListener("languagechange", (event) => {
    void loadAndRenderProjects(event.detail?.lang || getCurrentLocale());
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

  window.addEventListener("pagehide", () => activeProjectSource?.dispose?.(), { once: true });

  document.addEventListener("keydown", (event) => {
    const activeElement = document.activeElement;
    const isEditableTarget =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      activeElement?.getAttribute("contenteditable") === "true";

    if (event.ctrlKey && event.shiftKey && event.key === "F12" && !isEditableTarget) {
      if (CMS_LOGIN_URL) window.open(CMS_LOGIN_URL, "_blank", "noopener,noreferrer");
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
