const Preferences = window.Store;

// ==========================================================================
// 1. NAVIGATION / TAB SWITCHING LOGIC
// ==========================================================================
window.showPage = function(pageId, buttonElement) {
    // Hide all pages
    const pages = document.querySelectorAll('.page-view');
    pages.forEach(page => page.classList.remove('active'));

    // Remove active state from all nav buttons
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Highlight target button
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
  const shopifyFrame = document.getElementById('shopify-frame');
  
  // Loaders for all pages
  const loaders = document.querySelectorAll('.page-loader, #compras-loader, .iframe-loader');
  const loaderTexts = document.querySelectorAll('.loader-text, #compras-loader-text');

  let isOfflineMode = false;

  function showOfflineState(message) {
    // 1. Add class to body -> triggers CSS to hide .header and .nav
    document.body.classList.add('app-offline');

    // 2. Update loader texts and show loader overlays
    loaderTexts.forEach(textEl => {
      if (textEl && message) textEl.textContent = message;
    });

    loaders.forEach(loader => {
      loader.classList.remove('hidden');
      loader.classList.add('visible');
    });
  }

  function hideOfflineState() {
    // 1. Remove class from body -> restores .header and .nav
    document.body.classList.remove('app-offline');

    // 2. Hide loader overlays
    loaders.forEach(loader => {
      loader.classList.remove('visible');
      loader.classList.add('hidden');
    });
  }

  function reloadStore() {
    if (shopifyFrame) {
      const srcdocVal = shopifyFrame.getAttribute('srcdoc');
      if (srcdocVal) {
        shopifyFrame.removeAttribute('srcdoc');
        setTimeout(() => {
          shopifyFrame.setAttribute('srcdoc', srcdocVal);
        }, 50);
      }
    }
  }

  // Active ping check (bypasses false navigator.onLine)
  function pingRealInternet() {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      fetch('https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js?v=' + Date.now(), {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      })
      .then(() => {
        clearTimeout(timeoutId);
        resolve(true); // Connected
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(false); // Disconnected
      });
    });
  }

  // Poll connectivity every 2 seconds
  setInterval(async () => {
    const hasInternet = await pingRealInternet();

    if (!hasInternet && !isOfflineMode) {
      isOfflineMode = true;
      showOfflineState('Sin conexión. Reintentando...');
    } else if (hasInternet && isOfflineMode) {
      isOfflineMode = false;
      showOfflineState('Cargando...');
      reloadStore();
      setTimeout(hideOfflineState, 1500);
    }
  }, 2000);

  // Initial startup check
  async function checkInitialLoad() {
    const online = await pingRealInternet();
    if (online) {
      setTimeout(hideOfflineState, 1500);
    } else {
      isOfflineMode = true;
      showOfflineState('Sin conexión. Reintentando...');
    }
  }

  checkInitialLoad();
});


// Auto-wire navigation buttons on load
document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const pageId = button.getAttribute('data-tab');
            if (pageId) {
                window.showPage(pageId, button);
            }
        });
    });
});

// ==========================================================================
// 2. USER DATA FETCHING LOGIC
// ==========================================================================


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function loadUser() {
    try {
        const { value } = await Preferences.get({ key: "data" });

        if (!value) {
            console.log("No login data found.");
            return;
        }

        const loginData = JSON.parse(value);
        console.log("loginData object:", loginData);
        await sleep(1000);

        const response = await fetch("https://login.bluend.org/fetch_data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                shopify_customer_id: loginData.shopifyCustomerId
            })
        });

        const data = await response.json();
        console.log("Fetched customer:", data);

        if (!data.success) {
            console.log("Failed to fetch customer.");
            return;
        }


        window.customerData = data.customer;

        
        const nameEl = document.getElementById("customerName");
        const pointsEl = document.getElementById("points");

        if (nameEl) nameEl.textContent = data.customer.customer_name || "Cliente";
        if (pointsEl) pointsEl.textContent = data.customer.points_balance ?? 0;

    } catch (error) {
        console.error("Error loading user data:", error);
    }
}







// ==========================================================================
// 3. DELETE ACCOUNT LOGIC
// ==========================================================================
function confirmDeleteAccount() {
    const confirmed = confirm(
        "¿Estás seguro de que quieres eliminar tu cuenta permanentemente?\n\n" +
        "Se borrarán todos tus puntos, historial y datos asociados.\n\n" +
        "Esta acción NO se puede deshacer."
    );

    if (confirmed) {
        deleteAccount();
    }
}

async function deleteAccount() {
    const btn = document.getElementById("btn-delete-account");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Eliminando...";
    }

    try {
        const { value } = await Preferences.get({ key: "data" });

        if (!value) {
            alert("No se encontró información de la cuenta.");
            return;
        }

        const loginData = JSON.parse(value);
        const customerId = loginData.shopifyCustomerId;

        if (!customerId) {
            alert("No se pudo obtener el ID del cliente.");
            return;
        }

        const response = await fetch("https://login.bluend.org/delete_account", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                shopify_customer_id: customerId
            })
        });

        const result = await response.json();

        if (result.success) {
            // Clear local login data
            await Preferences.remove({ key: "data" });

            alert("Tu cuenta ha sido eliminada correctamente.");

            // Redirect to login page (one directory up)
            window.location.href = "../index.html";
        } else {
            alert("Error al eliminar la cuenta: " + (result.error || "Inténtalo de nuevo."));
        }

    } catch (error) {
        console.error("Error deleting account:", error);
        alert("Error de conexión. Verifica tu internet e inténtalo de nuevo.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Eliminar cuenta";
        }
    }
}

loadUser();
