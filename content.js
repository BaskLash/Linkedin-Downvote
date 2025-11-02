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

// === Client-ID (EINHEITLICH über chrome.storage.local) ===
async function getClientId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['client_id'], (result) => {
      let id = result.client_id;
      if (!id) {
        id = crypto.randomUUID();
        chrome.storage.local.set({ client_id: id }, () => resolve(id));
      } else {
        resolve(id);
      }
    });
  });
}

// === Voted-Posts (auch in chrome.storage.local) ===
async function getVotedPosts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['linkdown-voted'], (result) => {
      resolve(result['linkdown-voted'] || []);
    });
  });
}

async function setVotedPosts(posts) {
  return chrome.storage.local.set({ 'linkdown-voted': posts });
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

// === Hauptfunktion: Posts verarbeiten (async!) ===
async function processPosts() {
  const bars = document.querySelectorAll(".feed-shared-social-action-bar");
  for (const bar of bars) {
    const post = bar.closest("div.feed-shared-update-v2, article, .occludable-update");
    if (!post || processedPosts.has(post)) continue;

    processedPosts.add(post);

    const postId = extractPostId(post);
    const clientId = await getClientId();

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

      span.appendChild(button);
      bar.insertBefore(span, bar.firstChild);

      // Zustand laden
      const votedPosts = await getVotedPosts();
      const isAlreadyDownvoted = votedPosts.includes(postId);

      label.textContent = isAlreadyDownvoted ? "Downvoted" : "Downvote";
      label.style.fontStyle = isAlreadyDownvoted ? "italic" : "normal";

      // === Klick: Toggle ===
      button.addEventListener("click", async () => {
        button.disabled = true;
        const currentVoted = await getVotedPosts();
        const isDisliked = currentVoted.includes(postId);
        const action = isDisliked ? "undislike" : "dislike";

        chrome.runtime.sendMessage(
          { action, post_id: postId, client_id: clientId },
          async (response) => {
            button.disabled = false;

            if (response?.success) {
              let updatedVoted = await getVotedPosts();

              if (isDisliked) {
                updatedVoted = updatedVoted.filter(id => id !== postId);
                label.textContent = "Downvote";
                label.style.fontStyle = "normal";
                if (counter) counter.textContent = Math.max(parseInt(counter.textContent) - 1, 0);
              } else {
                updatedVoted.push(postId);
                label.textContent = "Downvoted";
                label.style.fontStyle = "italic";
                if (counter) counter.textContent = parseInt(counter.textContent) + 1;
              }

              await setVotedPosts(updatedVoted);
              updateDislikeCount(postId, counter);
            } else {
              alert(response?.message || "Fehler beim Server.");
            }
          }
        );
      });
    }
  }
}

// --- Effizienter Scroll-Observer ---
let scrollTimeout;
window.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => processPosts().catch(console.error), 100);
});

// === Initialer Aufruf ===
processPosts().catch(console.error);