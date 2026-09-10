async function loadActivityFeed() {
  const ENDPOINT_URL = "https://login.bluend.org/get_history";

  try {
    const PreferencesPlugin = window.Store;

    if (!PreferencesPlugin) {
      console.error("Storage backend (common.js) is not loaded.");
      return;
    }

    // 1. Fetch the string stored under key "data"
    const { value } = await PreferencesPlugin.get({ key: "data" });
    console.log("Raw stored string:", value);

    if (!value) {
      console.warn("No value found in storage for key 'data'. User may not be logged in yet.");
      return;
    }

    // 2. Parse the stringified JSON object
    const parsedObject = JSON.parse(value);
    console.log("Parsed object:", parsedObject);

    // 3. Extract shopifyCustomerId
    const customerId = parsedObject.shopifyCustomerId;
    console.log("Extracted ID:", customerId);

    if (!customerId) {
      console.warn("shopifyCustomerId property was missing from the parsed object.");
      return;
    }

    // 4. Trigger activity fetch
    initActivityHistory(customerId, ENDPOINT_URL);

  } catch (error) {
    console.error("Error reading from Preferences:", error);
  }
}

async function initActivityHistory(customerId, endpointUrl) {
  const historyContainer = document.getElementById("transaction-history-container");

  if (!historyContainer) {
    console.error("Missing #transaction-history-container in HTML");
    return;
  }

  // Show Loading State
  historyContainer.innerHTML = '<div class="card"><p>Loading activity...</p></div>';

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopifyCustomerId: customerId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // 🔍 SERVER RESPONSE LOG
    console.log("SERVER RESPONSE:", data);

    // Render History Feed
    renderTransactionList(data.history || [], historyContainer);

  } catch (error) {
    console.error("Error fetching activity history:", error);
    historyContainer.innerHTML = `
      <div class="card">
        <h3>Unable to load activity</h3>
        <p>Could not connect to server. Please check your network.</p>
      </div>
    `;
  }
}

function renderTransactionList(transactions, container) {
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="card">
        <h3>No Activity Yet</h3>
        <p>Purchases and earned points will show up here.</p>
      </div>
    `;
    return;
  }

  const html = transactions.map((tx) => {
    // Date formatting
    const txDate = tx.timestamp 
      ? new Date(tx.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "N/A";

    const isPurchase = tx.type === "PURCHASE";
    const pointsFormatted = tx.points_earned > 0 ? `+${tx.points_earned}` : tx.points_earned;
    const spentAmount = Number(tx.money_spent || 0).toFixed(2);
    
    // Header title
    const title = isPurchase 
  ? `Orden #${String(tx.order_id || 'N/A').slice(-5)}` 
  : (tx.type || "Points Event").replace(/_/g, " ");

    // Receipt URL button
    const receiptLink = tx.purchase_receipt_url
      ? `<a href="${tx.purchase_receipt_url}" target="_blank" class="receipt-btn">Ver Recibo &rarr;</a>`
      : "";

    return `
      <div class="card tx-card">
        <div class="tx-header">
          <div>
            <h3>${title}</h3>
            <p class="tx-date">${txDate}</p>
          </div>
        </div>
        
        <div class="tx-details">
          <span class="tx-amount">Spent: $${spentAmount}</span>
          ${receiptLink}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

// Make loadActivityFeed available globally for DevTools console calls
window.loadActivityFeed = loadActivityFeed;

// Auto-run when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadActivityFeed);
} else {
  loadActivityFeed();
}