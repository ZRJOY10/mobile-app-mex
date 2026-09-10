(function () {

  var toggle = document.querySelector('.view-toggle');
  var frame = document.getElementById('shopify-frame');

  if (!toggle || !frame) { return; }

  var buttons = toggle.querySelectorAll('.view-btn');
  var retryTimer = null;

  var DEFAULT_VIEW = 'grid';

  function push(mode) {
    try {
      var w = frame.contentWindow;
      if (w && typeof w.applyStoreView === 'function') {
        w.applyStoreView(mode);
        return true;
      }
    } catch (e) {
    }
    return false;
  }

  function paint(mode) {
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-view') === mode;
      buttons[i].classList.toggle('is-active', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function setView(mode) {
    mode = (mode === 'list') ? 'list' : 'grid';

    paint(mode);

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    if (!push(mode)) {
      var tries = 0;
      retryTimer = setInterval(function () {
        tries++;
        if (push(mode) || tries > 75) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 400);
    }
  }

  toggle.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.view-btn') : null;
    if (btn) {
      setView(btn.getAttribute('data-view'));
    }
  });

  frame.addEventListener('load', function () {
    setView(DEFAULT_VIEW);
  });

  setView(DEFAULT_VIEW);

})();
