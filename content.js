// === LinkedIn Dislike Extension – content.js ===
// Robuste Post-ID Erkennung + API via background.js

const processedPosts = new WeakSet();

// === Robuste Post-ID Erkennung ===
function extractPostId(postElement) {
  const urnRegex = /urn:li:(?:activity|share):(\d+)/i;

  // 1. Direkt: data-urn oder data-id am Post oder in Eltern
  let current = postElement;
  while (current && current !== document.body) {
    if (current.dataset?.urn) {
      const match = current.dataset.urn.match(urnRegex);
      if (match) return match[1];
    }
    if (current.dataset?.id) {
      return current.dataset.id;
    }
    current = current.parentElement;
  }

  // 2. Links im Post: /activity/123... oder /posts/
  const link = postElement.querySelector('a[href*="/activity/"], a[href*="/posts/"]');
  if (link?.href) {
    const url = link.href;
    const activityMatch = url.match(/activity[/-](\d+)/i);
    if (activityMatch) return activityMatch[1];

    const urnMatch = url.match(/urn:li:(?:activity|share):(\d+)/i);
    if (urnMatch) return urnMatch[1];
  }

  // 3. Fallback: data-urn in Kind-Elementen
  const urnEl = postElement.querySelector('[data-urn]');
  if (urnEl?.dataset?.urn) {
    const match = urnEl.dataset.urn.match(urnRegex);
    if (match) return match[1];
  }

  // 4. Letzter Ausweg: temporäre ID
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.warn("Keine echte post_id gefunden → verwende:", tempId);
  return tempId;
}

// === Client-ID ===
function getClientId() {
  const key = "linkdown-client-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// === Dislike-Count vom Server laden ===
function updateDislikeCount(postId, counterElement) {
  chrome.runtime.sendMessage(
    { action: "get-dislike-count", post_id: postId },
    (response) => {
      if (response && typeof response.dislike_count === "number") {
        counterElement.textContent = response.dislike_count;
      }
    }
  );
}

// === Hauptfunktion: Posts verarbeiten ===
function processPosts() {
  const bars = document.querySelectorAll(".feed-shared-social-action-bar");
  bars.forEach(bar => {
    const post = bar.closest("div.feed-shared-update-v2, article, .occludable-update");
    if (!post || processedPosts.has(post)) return;

    processedPosts.add(post);

    // === 1. Post-ID (eindeutig!) ===
    const postId = extractPostId(post);
    const clientId = getClientId();

    // === 2. Zähler-Button (einmalig) ===
    let counter = post.querySelector(".linkdown-metrics-count");
    if (!counter) {
      const reactionsContainer = post.querySelector(".social-details-social-counts");
      const targetLi = reactionsContainer?.querySelector("li[class^='social-details']");
      if (targetLi) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", "0 downvotes");
        button.className = "t-black--light display-flex align-items-center social-details-social-counts__count-value text-body-small hoverable-link-text linkdown-downvote-metrics";
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

        button.appendChild(img);
        button.appendChild(counter);
        targetLi.appendChild(button);

        // Lade aktuelle Zahl vom Server
        updateDislikeCount(postId, counter);
      }
    }

    // === 3. Downvote-Button (einmalig) ===
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
      label.style.fontSize = "14px";
      label.style.color = "#666";
      button.appendChild(label);

      // === Zustand beim Laden prüfen ===
      const votedPosts = JSON.parse(localStorage.getItem("linkdown-voted") || "[]");
      const isAlreadyDownvoted = votedPosts.includes(postId);

      if (isAlreadyDownvoted) {
        label.textContent = "Downvoted";
        label.style.fontStyle = "italic";
      } else {
        label.textContent = "Downvote";
        label.style.fontStyle = "normal";
      }

      span.appendChild(button);
      bar.insertBefore(span, bar.firstChild);

      // === Klick: Toggle Dislike / Undo ===
      button.addEventListener("click", () => {
        const votedPosts = JSON.parse(localStorage.getItem("linkdown-voted") || "[]");
        const isDisliked = votedPosts.includes(postId);

        button.disabled = true;
        const action = isDisliked ? "undislike" : "dislike";

        chrome.runtime.sendMessage(
          { action, post_id: postId, client_id: clientId },
          (response) => {
            button.disabled = false;

            if (response?.success) {
              if (isDisliked) {
                // Undo
                const index = votedPosts.indexOf(postId);
                if (index > -1) votedPosts.splice(index, 1);
                localStorage.setItem("linkdown-voted", JSON.stringify(votedPosts));

                label.textContent = "Downvote";
                label.style.fontStyle = "normal";

                if (counter) {
                  const current = parseInt(counter.textContent, 10) || 0;
                  counter.textContent = Math.max(current - 1, 0);
                }
              } else {
                // Neuer Downvote
                votedPosts.push(postId);
                localStorage.setItem("linkdown-voted", JSON.stringify(votedPosts));

                label.textContent = "Downvoted";
                label.style.fontStyle = "italic";

                if (counter) {
                  const current = parseInt(counter.textContent, 10) || 0;
                  counter.textContent = current + 1;
                }
              }

              // Immer: vom Server neu laden (sicherheitshalber)
              updateDislikeCount(postId, counter);
            } else {
              alert(response?.message || "Fehler beim Aktualisieren.");
            }
          }
        );
      });
    }
  });
}

// === Scroll-Observer (debounced) ===
let scrollTimeout;
window.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(processPosts, 150);
});

// === Initialer Aufruf ===
processPosts();

// === Optional: MutationObserver für dynamische Inhalte ===
const observer = new MutationObserver((mutations) => {
  if (mutations.some(m => m.addedNodes.length > 0)) {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(processPosts, 200);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
