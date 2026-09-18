(function () {
  "use strict";

  // Menu mobile
  var navToggle = document.getElementById("navToggle");
  var siteNav = document.getElementById("siteNav");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Header : se cache en descendant, revient en remontant
  var header = document.querySelector(".site-header");
  if (header) {
    var lastY = window.scrollY;
    var ticking = false;

    var updateHeader = function () {
      var y = window.scrollY;
      var menuOpen = siteNav && siteNav.classList.contains("is-open");
      if (!menuOpen && y > lastY && y > header.offsetHeight * 1.5) {
        header.classList.add("site-header--hidden");
      } else {
        header.classList.remove("site-header--hidden");
      }
      lastY = y;
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(updateHeader);
          ticking = true;
        }
      },
      { passive: true }
    );
  }

  // Verre de progression de lecture : se remplit avec le scroll
  var wineLiquid = document.querySelector("[data-wine-progress-liquid]");
  if (wineLiquid) {
    var wineTicking = false;
    var maxLiquidHeight = 40;
    var liquidBottom = 45;

    var updateWineProgress = function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var fraction = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
      var h = fraction * maxLiquidHeight;
      wineLiquid.setAttribute("height", h.toFixed(2));
      wineLiquid.setAttribute("y", (liquidBottom - h).toFixed(2));
      wineTicking = false;
    };

    window.addEventListener(
      "scroll",
      function () {
        if (!wineTicking) {
          window.requestAnimationFrame(updateWineProgress);
          wineTicking = true;
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", updateWineProgress);
    updateWineProgress();
  }

  // Carrousel d'avis
  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function initCarousel(root) {
    var track = root.querySelector("[data-carousel-track]");
    var slides = Array.prototype.slice.call(root.querySelectorAll(".carousel__slide"));
    var prevBtn = root.querySelector("[data-carousel-prev]");
    var nextBtn = root.querySelector("[data-carousel-next]");
    var progressFill = root.querySelector("[data-carousel-progress]");
    var status = root.querySelector("[data-carousel-status]");
    var count = slides.length;
    if (!track || count === 0) return;

    var index = 0;
    var timer = null;
    var autoplayDelay = 6000;
    var isPointerDown = false;

    function updateUI() {
      if (progressFill) {
        progressFill.style.width = (100 / count) + "%";
        progressFill.style.transform = "translateX(" + index * 100 + "%)";
      }
      if (status) {
        status.textContent = "Avis " + (index + 1) + " sur " + count;
      }
    }

    function goTo(i, behavior) {
      index = (i + count) % count;
      track.scrollTo({ left: index * track.clientWidth, behavior: behavior || "smooth" });
      updateUI();
    }

    function next() { goTo(index + 1); resetAutoplay(); }
    function prev() { goTo(index - 1); resetAutoplay(); }

    function startAutoplay() {
      if (reduceMotionQuery.matches || count <= 1) return;
      stopAutoplay();
      timer = window.setInterval(function () { goTo(index + 1); }, autoplayDelay);
    }
    function stopAutoplay() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }
    function resetAutoplay() { stopAutoplay(); startAutoplay(); }

    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (nextBtn) nextBtn.addEventListener("click", next);

    // Garde l'index à jour quand l'utilisateur swipe/scrolle à la main
    var scrollTicking = false;
    track.addEventListener(
      "scroll",
      function () {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(function () {
          var width = track.clientWidth || 1;
          var i = Math.round(track.scrollLeft / width);
          i = Math.max(0, Math.min(count - 1, i));
          if (i !== index) {
            index = i;
            updateUI();
          }
          scrollTicking = false;
        });
      },
      { passive: true }
    );

    // Navigation clavier (flèches gauche/droite)
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { next(); }
      else if (e.key === "ArrowLeft") { prev(); }
    });

    // Pause au survol / au focus / pendant une interaction tactile
    root.addEventListener("mouseenter", stopAutoplay);
    root.addEventListener("mouseleave", startAutoplay);
    root.addEventListener("focusin", stopAutoplay);
    root.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) startAutoplay();
    });
    track.addEventListener("pointerdown", function () {
      isPointerDown = true;
      stopAutoplay();
    });
    window.addEventListener("pointerup", function () {
      if (isPointerDown) {
        isPointerDown = false;
        resetAutoplay();
      }
    });

    reduceMotionQuery.addEventListener("change", function () {
      if (reduceMotionQuery.matches) stopAutoplay();
      else startAutoplay();
    });

    window.addEventListener("resize", function () {
      goTo(index, "auto");
    });

    updateUI();
    startAutoplay();
  }

  document.querySelectorAll("[data-carousel]").forEach(initCarousel);

  // Formulaire de réservation / contact (Netlify Forms, envoi en AJAX)
  var contactForm = document.getElementById("contactForm");
  if (contactForm) {
    var statusEl = contactForm.querySelector("[data-form-status]");
    var submitBtn = contactForm.querySelector(".form__submit");

    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var formData = new FormData(contactForm);
      var body = new URLSearchParams();
      formData.forEach(function (value, key) { body.append(key, value); });

      if (submitBtn) submitBtn.disabled = true;
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.removeAttribute("data-state");
      }

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      })
        .then(function (response) {
          if (!response.ok) throw new Error("network");
          contactForm.reset();
          contactForm.hidden = true;
          if (statusEl) {
            statusEl.textContent = "Merci, votre demande a bien été envoyée — on vous répond très vite.";
            statusEl.setAttribute("data-state", "success");
            statusEl.hidden = false;
          }
        })
        .catch(function () {
          if (statusEl) {
            statusEl.textContent = "L'envoi a échoué. Réessayez, ou écrivez-nous directement sur Instagram.";
            statusEl.setAttribute("data-state", "error");
            statusEl.hidden = false;
          }
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  // Popup de réservation (une fois par session)
  var popup = document.getElementById("reservePopup");
  if (popup) {
    var STORAGE_KEY = "millesime-reserve-popup-seen";
    var alreadySeen = false;
    try { alreadySeen = window.sessionStorage.getItem(STORAGE_KEY) === "1"; } catch (err) {}

    if (!alreadySeen) {
      var closeBtn = popup.querySelector("[data-reserve-popup-close]");
      var ctaLink = popup.querySelector("[data-reserve-popup-cta]");

      var markSeen = function () {
        try { window.sessionStorage.setItem(STORAGE_KEY, "1"); } catch (err) {}
      };

      var hidePopup = function () {
        popup.classList.remove("is-visible");
        markSeen();
        window.setTimeout(function () { popup.hidden = true; }, 650);
      };

      window.setTimeout(function () {
        popup.hidden = false;
        window.requestAnimationFrame(function () {
          popup.classList.add("is-visible");
        });
      }, 3500);

      if (closeBtn) closeBtn.addEventListener("click", hidePopup);
      if (ctaLink) ctaLink.addEventListener("click", markSeen);
    }
  }

  // Révélation douce au scroll
  var revealEls = document.querySelectorAll("[data-reveal]");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (revealEls.length && "IntersectionObserver" in window && !reduceMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
