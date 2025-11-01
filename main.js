document.querySelectorAll(".feed-shared-social-action-bar").forEach(bar => {
  // Finde den Post-Container
  const post = bar.closest("div.feed-shared-update-v2");
  if (!post) return;

  // Finde oder erstelle Zähler im Footer
  let counter = post.querySelector(".social-details-social-counts__reactions-count.linkdown-metrics-count");

  // Falls noch kein Downvote-Zähler existiert → anlegen
  if (!counter) {
    const reactionsContainer = post.querySelector(".social-details-social-counts");
    const targetLi = reactionsContainer?.querySelector("li[class^='social-details']");
    if (targetLi) {
      const button = document.createElement("button");
      button.setAttribute("data-reaction-details", "");
      button.setAttribute("aria-label", "0 downvotes");
      button.className =
        "t-black--light display-flex align-items-center social-details-social-counts__count-value social-details-social-counts__count-value-hover text-body-small hoverable-link-text linkdown-downvote-metrics";
      button.type = "button";
      button.style.marginLeft = "10px";
      button.style.cursor = "unset";
      button.style.display = "flex";
      button.style.alignItems = "center";
      button.style.gap = "4px";

      // Emoji
      const img = document.createElement("img");
      img.src =
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><text y='14' font-size='14'>👎</text></svg>";
      img.alt = "downvote";

      // Zähler
      counter = document.createElement("span");
      counter.className =
        "social-details-social-counts__reactions-count linkdown-metrics-count";
      counter.style.fontWeight = "bold";
      counter.textContent = "0";

      button.appendChild(img);
      button.appendChild(counter);
      targetLi.appendChild(button);
    }
  }

  // --- DOWNVOTE BUTTON im Action-Bar ---
  const span = document.createElement("span");
  span.className =
    "reactions-react-button feed-shared-social-action-bar__action-button feed-shared-social-action-bar--new-padding";

  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = "👎";
  button.title = "Downvote";
  button.className =
    "artdeco-button artdeco-button--muted artdeco-button--3 artdeco-button--tertiary ember-view social-actions-button react-button__trigger";
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

  // --- Klicklogik: Zähler nur für diesen Post erhöhen ---
  button.addEventListener("click", () => {
    if (counter) {
      let current = parseInt(counter.textContent, 10) || 0;
      counter.textContent = current + 1;
    } else {
      console.warn("Kein Downvote-Zähler gefunden für diesen Post.");
    }
  });
});
