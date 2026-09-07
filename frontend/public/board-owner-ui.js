(() => {
  const sync = () => {
    document.querySelectorAll('.panel').forEach((panel) => {
      const buttons = Array.from(panel.querySelectorAll('button'));
      const ownerEdit = buttons.find((button) => {
        const text = button.textContent?.trim();
        return text === 'Edit My Board' || text === 'Save Changes' || text === 'Cancel';
      });

      // An active board that belongs to the current user keeps the existing
      // owner-only edit UI and hides the booking/checkout controls below it.
      if (ownerEdit) {
        panel.setAttribute('data-owned-board', 'true');
        panel.querySelectorAll('[data-hidden-for-booked]').forEach((el) => {
          el.removeAttribute('data-hidden-for-booked');
          el.style.removeProperty('display');
        });

        const ownerSection = ownerEdit.parentElement;
        if (!ownerSection) return;

        let node = ownerSection.nextElementSibling;
        while (node) {
          node.setAttribute('data-hidden-for-owner', 'true');
          node.style.display = 'none';
          node = node.nextElementSibling;
        }
        return;
      }

      panel.removeAttribute('data-owned-board');
      panel.querySelectorAll('[data-hidden-for-owner]').forEach((el) => {
        el.removeAttribute('data-hidden-for-owner');
        el.style.removeProperty('display');
      });

      // If another advertiser owns this board, the popup contains an "Ends"
      // row. Keep the company/footfall/end-time information, but remove every
      // booking/checkout control starting at "Booking duration".
      const directChildren = Array.from(panel.children);
      const hasActiveBooking = directChildren.some((el) =>
        el.textContent?.trim().startsWith('Ends'),
      );
      if (!hasActiveBooking) {
        panel.querySelectorAll('[data-hidden-for-booked]').forEach((el) => {
          el.removeAttribute('data-hidden-for-booked');
          el.style.removeProperty('display');
        });
        return;
      }

      const bookingStart = directChildren.find((el) =>
        el.textContent?.trim().startsWith('Booking duration'),
      );
      if (!bookingStart) return;

      let node = bookingStart;
      while (node) {
        node.setAttribute('data-hidden-for-booked', 'true');
        node.style.display = 'none';
        node = node.nextElementSibling;
      }
    });
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
