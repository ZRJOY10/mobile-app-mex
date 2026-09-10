/**
 * rewards-view.js
 * Dynamic Reward & Redemption Tiers (Hybrid Approach)
 * - Local storage (Capacitor Preferences) acts strictly as a cache.
 * - On every poll (5s), local storage is compared against /get_active_coupons.
 * - If a stored coupon key does NOT exist in the server's active list, it is 
 *   DELETED from local storage immediately, forcing the user to re-redeem.
 */

(function () {
  const ENDPOINTS = {
    fetchData: "https://login.bluend.org/fetch_data",
    getRewardsCatalog: "https://login.bluend.org/get_rewards_catalog",
    redeemCoupon: "https://login.bluend.org/redeem_coupon",
    getActiveCoupons: "https://login.bluend.org/get_active_coupons",
  };

  const STORAGE_KEYS = {
    activeCoupons: "active_user_coupons",
  };

  const PremiosState = {
    customerId: null,
    points: 0,
    offers: [],
    activeHeroOffer: null,
    savedCoupons: {}, // Local Cache: { reward_1 -> { code, title, qrUrl } }
    pollInterval: null,
    isFetching: false,
  };

  /* ==========================================
     GLOBAL HANDLERS (EXPOSED EARLY TO WINDOW)
     ========================================== */

  window.closeQrModal = function () {
    const modal = document.getElementById("qr-modal");
    if (modal) modal.remove();
  };

  window.closeQrModalOnOverlay = function (event) {
    if (event.target.id === "qr-modal") window.closeQrModal();
  };

  window.openQrModal = function (title, code, qrUrl) {
    const qrImageSource =
      qrUrl || `https://quickchart.io/qr?text=${encodeURIComponent(code)}&size=200`;

    const modalHtml = `
      <div id="qr-modal" class="qr-modal-overlay" onclick="closeQrModalOnOverlay(event)">
        <div class="qr-modal-card">
          <button class="qr-close-btn" onclick="closeQrModal()">&times;</button>
          <div class="qr-header">
            <h3>${title}</h3>
            <p>Muestra este código en caja para aplicar tu descuento</p>
          </div>
          <div class="qr-image-wrapper">
            <img src="${qrImageSource}" alt="Código QR ${code}">
          </div>
          <div class="qr-code-text-wrapper">
            <span class="qr-code-label">CÓDIGO:</span>
            <span class="qr-code-str">${code}</span>
          </div>
          <button class="qr-action-btn" onclick="closeQrModal()">Entendido</button>
        </div>
      </div>
    `;

    window.closeQrModal();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  };

  window.handleHeaderRedeemClick = function () {
    if (!PremiosState.activeHeroOffer) return;
    const hero = PremiosState.activeHeroOffer;
    window.handleRedeemClick(hero.id, hero.title);
  };

  window.handleRedeemClick = function (rewardId, rewardTitle) {
    if (!PremiosState.customerId) return;

    const storageKey = `reward_${rewardId}`;
    const saved = PremiosState.savedCoupons[storageKey];

    // If code exists locally and is verified active, open QR directly
    if (saved) {
      window.openQrModal(saved.title, saved.code, saved.qrUrl);
      return;
    }

    showPremiosLoader(true);

    redeemRewardApi(PremiosState.customerId, rewardId)
      .then(function (res) {
        if (!res || res.success === false) {
          throw new Error(res?.message || res?.error || "No fue posible generar el cupón.");
        }

        const couponData = res.coupon || {};
        const title = couponData.title || rewardTitle || "Cupón de Descuento";
        const code = couponData.code;

        if (!code) {
          throw new Error("El servidor no devolvió un código de descuento válido.");
        }

        const qrUrl = couponData.qr_url || res.qr_url || "";

        // Save to Capacitor storage and open QR modal
        return saveCouponToStorage(rewardId, { code: code, title: title, qrUrl: qrUrl }).then(function () {
          window.openQrModal(title, code, qrUrl);
          refreshRewardsView(false);
        });
      })
      .catch(function (err) {
        alert("Error al canjear: " + err.message);
      })
      .finally(function () {
        showPremiosLoader(false);
      });
  };

  window.loadRewardsView = function () {
    refreshRewardsView(true);
    startAutoPolling();
  };

  /* ==========================================
     CAPACITOR STORAGE HELPERS
     ========================================== */

  function getPreferencesPlugin() {
    return window.Store || null;
  }

  function getSavedCouponsFromStorage() {
    return new Promise(function (resolve) {
      const Preferences = getPreferencesPlugin();
      if (!Preferences) return resolve({});

      Preferences.get({ key: STORAGE_KEYS.activeCoupons })
        .then(function (result) {
          if (!result || !result.value) return resolve({});
          resolve(JSON.parse(result.value) || {});
        })
        .catch(function () { resolve({}); });
    });
  }

  function saveCouponToStorage(rewardId, couponData) {
    return new Promise(function (resolve) {
      PremiosState.savedCoupons[`reward_${rewardId}`] = couponData;

      const Preferences = getPreferencesPlugin();
      if (!Preferences) return resolve();

      Preferences.set({
        key: STORAGE_KEYS.activeCoupons,
        value: JSON.stringify(PremiosState.savedCoupons),
      }).then(resolve).catch(resolve);
    });
  }

  function removeCouponFromStorage(rewardId) {
    return new Promise(function (resolve) {
      delete PremiosState.savedCoupons[`reward_${rewardId}`];

      const Preferences = getPreferencesPlugin();
      if (!Preferences) return resolve();

      Preferences.set({
        key: STORAGE_KEYS.activeCoupons,
        value: JSON.stringify(PremiosState.savedCoupons),
      }).then(resolve).catch(resolve);
    });
  }

  function getCustomerIdFromStorageSafe() {
    return new Promise(function (resolve) {
      try {
        const PreferencesPlugin = window.Store;
        if (!PreferencesPlugin) return resolve(null);

        PreferencesPlugin.get({ key: "data" })
          .then(function (result) {
            if (!result || !result.value) return resolve(null);
            const parsed = JSON.parse(result.value);
            resolve(parsed.shopifyCustomerId || parsed.customerId || null);
          })
          .catch(function () { resolve(null); });
      } catch (err) {
        resolve(null);
      }
    });
  }

  /* ==========================================
     API CALLS
     ========================================== */

  function fetchCustomerData(customerId) {
    return fetch(ENDPOINTS.fetchData, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopify_customer_id: customerId }),
    }).then(res => res.ok ? res.json() : null);
  }

  function fetchRewardsCatalog(customerId) {
    return fetch(ENDPOINTS.getRewardsCatalog, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopifyCustomerId: customerId }),
    }).then(res => res.ok ? res.json() : null);
  }

  function fetchActiveCoupons(customerId) {
    return fetch(ENDPOINTS.getActiveCoupons, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopifyCustomerId: customerId }),
    }).then(res => res.ok ? res.json() : null);
  }

  function redeemRewardApi(customerId, rewardId) {
    return fetch(ENDPOINTS.redeemCoupon, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopifyCustomerId: customerId, rewardId: rewardId }),
    }).then(res => res.ok ? res.json() : null);
  }

  function showPremiosLoader(show) {
    const loader = document.getElementById("premios-loader");
    if (loader) loader.style.display = show ? "flex" : "none";
  }

  /* ==========================================
     STRICT LOCAL vs SERVER VALIDATION & SYNC
     ========================================== */

  function validateAndSyncLocalCoupons(serverActiveCoupons) {
    const activeList = Array.isArray(serverActiveCoupons) ? serverActiveCoupons : [];
    const storedKeys = Object.keys(PremiosState.savedCoupons);

    // 1. CHECK CAPACITOR STORAGE AGAINST SERVER PAYLOAD
    storedKeys.forEach(function (key) {
      const rewardId = key.replace("reward_", "");
      const storedItem = PremiosState.savedCoupons[key];

      // Find matching active coupon returned by /get_active_coupons
      const serverMatch = activeList.find(function (c) {
        const idMatches = String(c.offer_id || c.reward_id) === String(rewardId);
        const codeMatches = c.code === storedItem.code;
        const isActive = !c.status || String(c.status).toUpperCase() === "ACTIVE";

        return (idMatches || codeMatches) && isActive;
      });

      // DOES NOT EXIST IN SERVER PAYLOAD -> DELETE FROM PHONE
      if (!serverMatch) {
        removeCouponFromStorage(rewardId);
      }
    });

    // 2. ALSO SYNC NEW/UPDATED SERVER COUPONS BACK TO CAPACITOR STORAGE
    activeList.forEach(function (serverCoupon) {
      if (serverCoupon.status && String(serverCoupon.status).toUpperCase() !== "ACTIVE") return;

      const offerId = serverCoupon.offer_id || serverCoupon.reward_id;
      if (!offerId || !serverCoupon.code) return;

      const storageKey = `reward_${offerId}`;
      const existing = PremiosState.savedCoupons[storageKey];

      // If missing or code changed, sync server data to local storage
      if (!existing || existing.code !== serverCoupon.code) {
        saveCouponToStorage(offerId, {
          code: serverCoupon.code,
          title: serverCoupon.title || "Cupón de Descuento",
          qrUrl: serverCoupon.qr_url || ""
        });
      }
    });

    // 3. IF QR MODAL IS OPEN, CLOSE IT IF THE CODE IS NO LONGER ACTIVE
    const openModal = document.getElementById("qr-modal");
    if (openModal) {
      const currentCodeElement = openModal.querySelector(".qr-code-str");
      if (currentCodeElement) {
        const activeCode = currentCodeElement.innerText.trim();
        const codeIsActiveOnServer = activeList.some(function (c) {
          const isActive = !c.status || String(c.status).toUpperCase() === "ACTIVE";
          return c.code === activeCode && isActive;
        });

        if (!codeIsActiveOnServer) {
          window.closeQrModal();
        }
      }
    }
  }







function updateHeaderCard(heroOffer) {

  const mainCard = document.getElementById("wallet-header-card");
  const inicioCard = document.getElementById("inicio-wallet-card");

  let tierClass = "tier-none";
  let badgeText = "SIN NIVEL";
  let titleText = "Sin cupones disponibles";
  let subInfoText = "Acumula más puntos para desbloquear tu primer descuento.";
  let buttonLabel = "Canjear Descuento";

  if (heroOffer) {

    const heroId = String(heroOffer.id);

    tierClass =
      heroId === "3"
        ? "tier-oro"
        : heroId === "2"
        ? "tier-plata"
        : "tier-bronce";

    badgeText =
      heroId === "3"
        ? "NIVEL ORO"
        : heroId === "2"
        ? "NIVEL PLATA"
        : "NIVEL BRONCE";

    titleText = heroOffer.title;

    subInfoText =
      heroOffer.description || "Descuento listo para usar";

    const saved =
      PremiosState.savedCoupons[`reward_${heroOffer.id}`];

    buttonLabel =
      saved
        ? "🎁 Ver Código QR"
        : "Canjear Descuento";
  }

  // Calculate expiration date
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 30);

  const formattedExpiration = expirationDate.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const cardBody = `
    <div class="tier-badge">${badgeText}</div>

    <div class="tier-discount-title">
      ${titleText}
    </div>

    <div class="tier-sub-info">
      ${subInfoText}
    </div>

    ${
      heroOffer
        ? `
          <div class="tier-expiration">
            Expira el ${formattedExpiration}
          </div>
        `
        : ""
    }
  `;

  if (mainCard) {

    mainCard.className =
      `wallet-header-card ${tierClass}`;

    mainCard.innerHTML =
      cardBody +
      (
        heroOffer
          ? `
            <button
              class="btn-tier-action"
              onclick="handleHeaderRedeemClick()"
            >
              ${buttonLabel}
            </button>
          `
          : ""
      );
  }

  if (inicioCard) {

    inicioCard.className =
      `wallet-header-card ${tierClass}`;

    inicioCard.innerHTML = cardBody;
  }
}




























function renderOffersList(offers, userPoints) {

  const container =
    document.getElementById("offers-list") ||
    document.getElementById("rewards-list-container");

  if (!container) return;

  const tierIds = ["1", "2", "3"];

  const additionalOffers = (offers || []).filter(function (offer) {
    return !tierIds.includes(String(offer.id));
  });

  const eligibleOffers = additionalOffers.filter(function (offer) {

    const cost = Number(
      offer.cost_pts ?? offer.points_cost ?? 0
    );

    return userPoints >= cost;
  });

  if (eligibleOffers.length === 0) {

    container.innerHTML = `
      <div class="empty-msg">
        <p>No hay más cupones adicionales disponibles en este momento.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = eligibleOffers

    .map(function (offer) {

      const saved =
        PremiosState.savedCoupons[`reward_${offer.id}`];

      const buttonLabel = saved ? "Ver QR" : "Canjear";

      // Calculate expiration date: 30 days from today
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      const formattedExpiration =
        expirationDate.toLocaleDateString("es-MX", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });

      return `

        <div class="reward-card offer-card">

          <div class="reward-info offer-info">

            <h4 class="offer-title">
              ${offer.title}
            </h4>

            <p class="offer-desc">
              ${offer.description || ""}
            </p>

            

          </div>

          <button
            class="btn-reward-redeem redeem-action-btn"
            onclick="handleRedeemClick('${offer.id}', '${offer.title}')"
          >
            ${buttonLabel}
          </button>

        </div>

      `;

    })

    .join("");
}

  /* ==========================================
     CORE LOGIC & AUTO-POLLING
     ========================================== */

  function refreshRewardsView(isInitial = false) {
    if (PremiosState.isFetching) return;
    PremiosState.isFetching = true;

    if (isInitial) showPremiosLoader(true);

    getCustomerIdFromStorageSafe()
      .then(function (customerId) {
        if (!customerId) return null;
        PremiosState.customerId = customerId;

        return Promise.all([
          getSavedCouponsFromStorage(),
          fetchCustomerData(customerId),
          fetchRewardsCatalog(customerId),
          fetchActiveCoupons(customerId),
        ]);
      })
      .then(function (results) {
        if (!results) return;

        const savedCoupons = results[0] || {};
        const customerResp = results[1] || {};
        const catalogResp = results[2] || {};
        const activeCouponsResp = results[3] || {};

        PremiosState.savedCoupons = savedCoupons;

        // Extract active coupons array from server
        const serverActiveCoupons = activeCouponsResp?.active_coupons || catalogResp?.active_coupons || [];

        // Validate local Capacitor storage against server active list & purge non-existent codes
        validateAndSyncLocalCoupons(serverActiveCoupons);

        // Update user points
        const rawPoints = customerResp?.customer?.points_balance ?? customerResp?.points_balance ?? 0;
        PremiosState.points = Number(rawPoints) || 0;

        // Select active Hero offer
        const tierIds = ["1", "2", "3"];
        PremiosState.offers = catalogResp?.offers || [];

        const candidateHeroOffers = PremiosState.offers
          .filter(offer => tierIds.includes(String(offer.id)))
          .sort((a, b) => {
            const costA = Number(a.cost_pts ?? a.points_cost ?? 0);
            const costB = Number(b.cost_pts ?? b.points_cost ?? 0);
            return costB - costA;
          });

        PremiosState.activeHeroOffer = candidateHeroOffers.find(offer => {
          const cost = Number(offer.cost_pts ?? offer.points_cost ?? 0);
          return PremiosState.points >= cost;
        }) || null;

        // Render UI
        updateHeaderCard(PremiosState.activeHeroOffer);
        renderOffersList(PremiosState.offers, PremiosState.points);
      })
      .catch(function (err) {
        console.error("Error updating rewards view:", err);
      })
      .finally(function () {
        PremiosState.isFetching = false;
        if (isInitial) showPremiosLoader(false);
      });
  }

  function startAutoPolling() {
    if (PremiosState.pollInterval) clearInterval(PremiosState.pollInterval);
    PremiosState.pollInterval = setInterval(function () {
      refreshRewardsView(false);
    }, 5000);
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.loadRewardsView();
    });
  } else {
    window.loadRewardsView();
  }
})();