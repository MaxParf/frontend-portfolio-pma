document.addEventListener('DOMContentLoaded', () => {
  const burger = document.querySelector('.header__burger');
  const menu = document.querySelector('.header__burger-menu');
  
  burger.addEventListener('click', () => {
    menu.classList.toggle('active');
    burger.classList.toggle('active');
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const burger = document.querySelector(".header__burger");
  const menu = document.querySelector(".header__menu");
  const body = document.body;
  const scrollBtn = document.getElementById("scrollToTop");
  const servicesSection = document.getElementById("services"); // якорь "Услуги"

  // Бургер-меню
  if (burger) {
    burger.addEventListener("click", () => {
      burger.classList.toggle("active");
      menu.classList.toggle("active");
      body.classList.toggle("lock");
    });
  }

  // Кнопка наверх
  if (scrollBtn && servicesSection) {
    window.addEventListener("scroll", () => {
      const servicesTop = servicesSection.offsetTop;
      if (window.scrollY >= servicesTop) {
        scrollBtn.style.display = "flex";
      } else {
        scrollBtn.style.display = "none";
      }
    });

    scrollBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }
});
