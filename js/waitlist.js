(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('waitlist-form');
    var emailInput = document.getElementById('wl-email');
    var msg = document.getElementById('wl-msg');
    var followReveal = document.getElementById('wl-follow-reveal');

    if (!form) return;

    function revealFollow() {
      if (followReveal) followReveal.classList.add('is-visible');
    }

    var category = form.getAttribute('data-category') || 'watches';

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = emailInput.value.trim();
      if (!email) return;

      var btn = form.querySelector('.wl-btn');
      var originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';
      msg.textContent = '';
      msg.className = 'wl-msg';

      try {
        var res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, category: category })
        });
        var data = await res.json();

        if (res.ok) {
          if (data.added) {
            msg.textContent = 'You\'re on the list.';
            msg.className = 'wl-msg wl-msg--success';
            emailInput.value = '';
          } else {
            msg.textContent = 'Already on the list.';
            msg.className = 'wl-msg wl-msg--info';
          }
          revealFollow();
        } else {
          msg.textContent = data.error || 'Something went wrong.';
          msg.className = 'wl-msg wl-msg--error';
        }
      } catch (err) {
        msg.textContent = 'Could not connect. Try again.';
        msg.className = 'wl-msg wl-msg--error';
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  });
})();
