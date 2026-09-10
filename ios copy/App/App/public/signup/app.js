const Preferences = window.Store;

let points = 0;

async function loadPage() {


    document.getElementById("points").textContent = points;

    const { value } = await Preferences.get({
        key: "data"
    });

    if (!value) {
        console.log("No login data found.");
        return;
    }

    const loginData = JSON.parse(value);

    console.log("Login data:", loginData);

    if (!loginData.shopifyCustomerId) {
        console.log("No Shopify customer ID.");
         return;
    }

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

    if (data.success) {

        points = data.customer.points_balance;

        document.getElementById("points").textContent = points;

    }

}

// Define your base API URL at the top of app.js
const BASE_URL = "https://login.bluend.org";

async function claim() {
    console.log("Claim button pressed.");

    // 1. Parse query parameters from URL (?phone=...&newShopifyId=true OR &shopifyCustomerId=...)
    const urlParams = new URLSearchParams(window.location.search);
    
    const phone = urlParams.get("phone");
    const isNewShopify = urlParams.get("newShopifyId") === "true";
    const shopifyCustomerId = urlParams.get("shopifyCustomerId");

    // 2. Get form field elements
    const nameInput = document.getElementById("name");
    const addressInput = document.getElementById("address");
    const pinInput = document.getElementById("pin");

    const name = nameInput ? nameInput.value.trim() : "";
    const address = addressInput ? addressInput.value.trim() : "";
    const pin = pinInput ? pinInput.value.trim() : "";


    // 3. Client-side input validation
    if (!name || !address || !pin) {
        alert("Por favor completa todos los campos.");
        return;
    }

    if (pin.length < 4 || pin.length > 6) {
        alert("El PIN debe tener entre 4 y 6 dígitos.");
        return;
    }

    // 4. Determine path and payload based on isNewShopify status
    let path = "";
    let payload = {};

    if (isNewShopify) {
        if (!phone) {
            alert("Número de teléfono no encontrado.");
            return;
        }
        path = "/new_shopify";
        payload = {
            phone: phone,
            name: name,
            address: address,
            pin: pin
        };
    } else {
        if (!shopifyCustomerId) {
            alert("ID de cliente de Shopify no encontrado.");
            console.log
            return;
        }
        path = "/existing_shopify";
        payload = {
            shopifyCustomerId: shopifyCustomerId,
            name: name,
            address: address,
            pin: pin
        };
    }

    // Combine base URL with path (e.g., https://login.bluend.org/new_shopify)
    const fullUrl = `${BASE_URL}${path}`;

    // 5. Disable submit button while request is in flight
    const claimButton = document.querySelector(".claim-card button");
    if (claimButton) claimButton.disabled = true;

    try {
        const response = await fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log(`Success via ${fullUrl}:`, result);
            await Preferences.set({ key: "data", value: JSON.stringify({ shopifyCustomerId: result.shopifyCustomerId || result.shopify_customer_id || result.id }) });
            window.location.href = "../main_menu/index.html";
        } else {
            alert(result.message || "Error al procesar la solicitud.");
            if (claimButton) claimButton.disabled = false;
        }
    } catch (error) {
        console.error("Error sending claim request:", error);
        alert("Error de conexión. Inténtalo de nuevo más tarde.");
        if (claimButton) claimButton.disabled = false;
    }
}
window.claim = claim;

loadPage(); 
