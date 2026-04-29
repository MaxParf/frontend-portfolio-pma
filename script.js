document.addEventListener("DOMContentLoaded", () => {
  const burger = document.querySelector(".site-header__burger");
  const navigation = document.getElementById("site-navigation");
  const body = document.body;
  const scrollBtn = document.getElementById("scrollToTop");
  const heroSection = document.getElementById("hero");

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
});
