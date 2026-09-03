(() => {
  const sync = () => {
    document.querySelectorAll('.panel').forEach((panel) => {
      const buttons = Array.from(panel.querySelectorAll('button'));
      const ownerEdit = buttons.find((button) => button.textContent?.trim() === 'Edit My Board');
      if (!ownerEdit) {
        panel.removeAttribute('data-owned-board');
        return;
      }

      panel.setAttribute('data-owned-board', 'true');
      const ownerSection = ownerEdit.parentElement;
      if (!ownerSection) return;

      // The booking controls are siblings immediately after the owner/edit section.
      // Hide them while keeping the owner's Edit My Board UI and board information visible.
      let node = ownerSection.nextElementSibling;
      while (node) {
        node.setAttribute('data-hidden-for-owner', 'true');
        node = node.nextElementSibling;
      }
    });
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
