(function () {

  var frame = document.getElementById('shopify-frame');
  var search = document.getElementById('compras-search');
  var filterBtn = document.getElementById('compras-filter');
  var pop = document.getElementById('filter-pop');
  var stockBox = document.getElementById('filter-stock');
  var fab = document.getElementById('cart-fab');
  var fabCount = document.getElementById('cart-count');
  var fabTotal = document.getElementById('cart-total');

  if (!frame) { return; }

  var sortMode = 'default';

  function api(name) {
    try {
      var w = frame.contentWindow;
      if (w && typeof w[name] === 'function') { return w[name]; }
    } catch (e) {}
    return null;
  }

  function pushAll() {
    var s = api('applyStoreSearch');
    if (s) { s(search ? search.value : ''); }

    var f = api('applyStoreStockFilter');
    if (f) { f(stockBox ? stockBox.checked : false); }

    var o = api('applyStoreSort');
    if (o) { o(sortMode); }
  }

  function markActive() {
    var on = sortMode !== 'default' || (stockBox && stockBox.checked);
    if (filterBtn) { filterBtn.classList.toggle('is-on', !!on); }
  }

  function openPop(show) {
    if (!pop || !filterBtn) { return; }
    pop.hidden = !show;
    filterBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
  }

  if (search) {
    var debounce = null;
    search.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(pushAll, 140);
    });
    search.addEventListener('search', pushAll);
  }

  if (filterBtn) {
    filterBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openPop(pop.hidden);
    });
  }

  if (pop) {
    pop.addEventListener('click', function (e) {
      e.stopPropagation();

      var opt = e.target.closest ? e.target.closest('.filter-opt') : null;
      if (opt) {
        sortMode = opt.getAttribute('data-sort');
        var all = pop.querySelectorAll('.filter-opt');
        for (var i = 0; i < all.length; i++) {
          all[i].classList.toggle('is-sel', all[i] === opt);
        }
        markActive();
        pushAll();
        openPop(false);
      }
    });
  }

  if (stockBox) {
    stockBox.addEventListener('change', function () {
      markActive();
      pushAll();
    });
  }

  document.addEventListener('click', function () {
    if (pop && !pop.hidden) { openPop(false); }
  });

  if (fab) {
    fab.addEventListener('click', function () {
      var fn = api('openStoreCart');
      if (fn) { fn(); }
    });
  }

  function refreshCart() {
    if (!fab) { return; }

    var fn = api('readCartState');
    if (!fn) { return; }

    var state = fn();
    var live = state.count > 0 && !state.open;

    fab.classList.toggle('is-live', live);
    if (!live) { return; }

    if (fabCount && fabCount.textContent !== String(state.count)) {
      fabCount.textContent = state.count;
    }
    if (fabTotal && state.total && fabTotal.textContent !== state.total) {
      fabTotal.textContent = state.total;
    }
  }

  frame.addEventListener('load', function () {
    if (search) { search.value = ''; }
    if (stockBox) { stockBox.checked = false; }
    sortMode = 'default';
    markActive();
    openPop(false);
  });

  setInterval(function () {
    refreshCart();
    pushAll();
  }, 600);

})();
