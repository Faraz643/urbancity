(() => {
  const sync = () => {
    document.querySelectorAll('.panel').forEach((panel) => {
      const buttons = Array.from(panel.querySelectorAll('button'));
      const ownerEdit = buttons.find((button) => {
        const text = button.textContent?.trim();
        return text === 'Edit My Board' || text === 'Save Changes' || text === 'Cancel';
      });
      if (!ownerEdit) {
        panel.removeAttribute('data-owned-board');
        panel.querySelectorAll('[data-hidden-for-owner]').forEach((el) => {
          el.removeAttribute('data-hidden-for-owner');
          el.style.removeProperty('display');
        });
        return;
      }

      panel.setAttribute('data-owned-board', 'true');
      const ownerSection = ownerEdit.parentElement;
      if (!ownerSection) return;

      // Everything after the owner's edit section is the booking/checkout UI.
      let node = ownerSection.nextElementSibling;
      while (node) {
        node.setAttribute('data-hidden-for-owner', 'true');
        node.style.display = 'none';
        node = node.nextElementSibling;
      }
    });
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
