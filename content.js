// Einmalig ausführen, z.B. in einer MutationObserver oder beim Scroll
const processedPosts = new WeakSet(); // Speichert bereits bearbeitete Posts

function processPosts() {
  document.querySelectorAll(".feed-shared-social-action-bar").forEach(bar => {
    const post = bar.closest("div.feed-shared-update-v2");
    if (!post || processedPosts.has(post)) return;

    processedPosts.add(post);

    // --- ZÄHLER (nur einmal pro Post) ---
    let counter = post.querySelector(".linkdown-metrics-count");
    if (!counter) {
      const reactionsContainer = post.querySelector(".social-details-social-counts");
      const targetLi = reactionsContainer?.querySelector("li[class^='social-details']");
      if (targetLi) {
        const button = document.createElement("button");
        button.setAttribute("data-reaction-details", "");
        button.setAttribute("aria-label", "0 downvotes");
        button.className = "t-black--light display-flex align-items-center social-details-social-counts__count-value social-details-social-counts__count-value-hover text-body-small hoverable-link-text linkdown-downvote-metrics";
        button.type = "button";
        button.style.marginLeft = "10px";
        button.style.cursor = "unset";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.gap = "4px";

        const img = document.createElement("img");
        img.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><text y='14' font-size='14'>👎</text></svg>";
        img.alt = "downvote";

        counter = document.createElement("span");
        counter.className = "social-details-social-counts__reactions-count linkdown-metrics-count";
        counter.style.fontWeight = "bold";
        counter.textContent = "0";
        counter.style.textDecoration = "none";

        button.appendChild(img);
        button.appendChild(counter);
        targetLi.appendChild(button);
      }
    }

    // --- DOWNVOTE BUTTON (nur wenn noch nicht vorhanden) ---
    if (!bar.querySelector(".react-button__trigger[title='Downvote']")) {
      const span = document.createElement("span");
      span.className = "reactions-react-button feed-shared-social-action-bar__action-button feed-shared-social-action-bar--new-padding";

      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = "👎";
      button.title = "Downvote";
      button.className = "artdeco-button artdeco-button--muted artdeco-button--3 artdeco-button--tertiary ember-view social-actions-button react-button__trigger";
      button.style.display = "flex";
      button.style.alignItems = "center";
      button.style.gap = "6px";

      const label = document.createElement("span");
      label.textContent = "Downvote";
      label.style.fontSize = "14px";
      label.style.color = "#666";

      button.appendChild(label);
      span.appendChild(button);
      bar.insertBefore(span, bar.firstChild);

      // Klicklogik
      button.addEventListener("click", () => {
        if (counter) {
          const current = parseInt(counter.textContent, 10) || 0;
          counter.textContent = current + 1;
        }
      });
    }
  });
}

// --- Effizienter Scroll-Observer ---
let scrollTimeout;
window.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(processPosts, 100); // Debounce
});

// Initialer Aufruf
processPosts();