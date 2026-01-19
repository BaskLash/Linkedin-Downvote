// === LinkedIn Dislike Extension – content.js ===
// Optimized RYD-style dislike estimation (DISPLAY ONLY)

const processedPosts = new WeakSet();
const SMOOTHING = 20;
const ACTIVE_COLOR = "#0a66c2";

// =========================
// GLOBAL CACHES
// =========================
let cachedClientId = null;
let votedCache = null;
let isProcessing = false;

// =========================
// UTILS
// =========================
function parseReactionCount(text) {
  if (!text) return 0;

  text = text
    .trim()
    .replace(/\u00A0|\u202F/g, '')
    .replace(/\s/g, '')
    .toUpperCase();

  if (text.endsWith('K')) {
    return Math.round(parseFloat(text.replace(',', '.')) * 1000);
  }

  if (text.endsWith('M')) {
    return Math.round(parseFloat(text.replace(',', '.')) * 1_000_000);
  }

  const digitsOnly = text.replace(/[^\d]/g, '');
  return parseInt(digitsOnly, 10) || 0;
}

function estimateDisplayedDislikes(rawDislikes, totalReactions) {
  if (totalReactions <= 0) return 0;
  const ratio =
    (rawDislikes + SMOOTHING) /
    (totalReactions + SMOOTHING * 2);
  return Math.max(0, Math.round(ratio * totalReactions));
}

// =========================
// POST ID (CACHED IN DOM)
// =========================
function extractPostId(post) {
  if (post.dataset.postId) return post.dataset.postId;

  const urnRegex = /urn:li:(?:activity|share):(\d+)/i;
  let current = post;

  while (current && current !== document.body) {
    if (current.dataset?.urn) {
      const m = current.dataset.urn.match(urnRegex);
      if (m) return (post.dataset.postId = m[1]);
    }
    current = current.parentElement;
  }

  const link = post.querySelector('a[href*="/activity/"], a[href*="/posts/"]');
  if (link?.href) {
    const m = link.href.match(/activity[/-](\d+)/i);
    if (m) return (post.dataset.postId = m[1]);
  }

  const temp =
    `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  post.dataset.postId = temp;
  return temp;
}

// =========================
// CLIENT ID (ONCE)
// =========================
async function getClientId() {
  if (cachedClientId) return cachedClientId;

  return new Promise((resolve) => {
    chrome.storage.local.get(['client_id'], (r) => {
      if (r.client_id) {
        cachedClientId = r.client_id;
        return resolve(r.client_id);
      }
      const id = crypto.randomUUID();
      chrome.storage.local.set({ client_id: id }, () => {
        cachedClientId = id;
        resolve(id);
      });
    });
  });
}

// =========================
// VOTED POSTS (MEMORY CACHE)
// =========================
async function getVotedPosts() {
  if (votedCache) return votedCache;

  return new Promise((resolve) => {
    chrome.storage.local.get(['linkdown-voted'], (r) => {
      votedCache = r['linkdown-voted'] || [];
      resolve(votedCache);
    });
  });
}

async function setPostVoted(postId, voted) {
  const list = await getVotedPosts();
  const has = list.includes(postId);

  if (voted && !has) list.push(postId);
  else if (!voted && has)
    votedCache = list.filter(id => id !== postId);
  else return;

  await chrome.storage.local.set({ 'linkdown-voted': votedCache });
}

// =========================
// UI HELPERS
// =========================
function applyDownvoteStyle(btn, active) {
  btn.style.color = active ? ACTIVE_COLOR : "";
  btn.style.fontWeight = active ? "600" : "";
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

// =========================
// SERVER → DISPLAY LOGIC
// =========================
function updateDislikeCount(post, postId, counter) {
  if (!counter || !counter.isConnected) return;

  chrome.runtime.sendMessage(
    { action: "get-dislike-count", post_id: postId },
    (response) => {
      const raw = response?.dislike_count ?? 0;

      if (!post.dataset.totalReactions) {
        const span = post.querySelector(
          "span.social-details-social-counts__reactions-count"
        );
        post.dataset.totalReactions =
          parseReactionCount(span?.innerText);
      }

      const total = Number(post.dataset.totalReactions) || 0;
      counter.textContent =
        estimateDisplayedDislikes(raw, total);
      counter.dataset.raw = raw;
    }
  );
}

// =========================
// MAIN PROCESSOR
// =========================
async function processPosts() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // More flexible bar detection
    const bars = document.querySelectorAll(
      ".feed-shared-social-action-bar, [role='toolbar']"
    );

    const clientId = await getClientId();
    const votedPosts = await getVotedPosts();

    for (const bar of bars) {
      // Ensure this toolbar belongs to a feed post
      if (!bar.querySelector("button")) continue;

      const post = bar.closest(
        "div.feed-shared-update-v2, article, .occludable-update"
      );
      if (!post || processedPosts.has(post)) continue;
      processedPosts.add(post);

      const postId = extractPostId(post);

      // =====================
      // DOWNVOTE BUTTON
      // =====================
      if (!bar.querySelector("[data-linkdown]")) {
        const span = document.createElement("span");
        span.className =
          "reactions-react-button feed-shared-social-action-bar__action-button";

        const btn = document.createElement("button");
        btn.dataset.linkdown = "true";
        btn.className =
          "artdeco-button artdeco-button--muted artdeco-button--tertiary";
        btn.textContent = "👎 Downvote";
        btn.title = "Downvote";

        span.appendChild(btn);

        // 🔑 Premium-safe anchor:
        // Insert next to the Like / React button
        const likeButton = bar.querySelector("button[aria-label*='Like'], button[aria-label*='React']");

        // 🧪 Detect Premium / experimental UI variants
        if (likeButton && !likeButton.offsetParent) {
          console.warn(
            "[LinkDown] Like button hidden or detached — different LinkedIn UI variant",
            { bar, postId }
          );
        }
        
        const anchor =
          likeButton?.closest("span, div");

        if (anchor?.parentElement) {
          anchor.parentElement.insertBefore(
            span,
            anchor.nextSibling
          );
        } else {
          // Fallback — append without breaking layout
          bar.appendChild(span);
        }

        let isDownvoted = votedPosts.includes(postId);
        applyDownvoteStyle(btn, isDownvoted);

        btn.addEventListener("click", () => {
          btn.disabled = true;

          chrome.runtime.sendMessage(
            {
              action: isDownvoted ? "undislike" : "dislike",
              post_id: postId,
              client_id: clientId
            },
            async (response) => {
              btn.disabled = false;
              if (!response?.success) return;

              isDownvoted = !isDownvoted;
              await setPostVoted(postId, isDownvoted);
              applyDownvoteStyle(btn, isDownvoted);

              const counter =
                post.querySelector(".linkdown-metrics-count");
              updateDislikeCount(post, postId, counter);
            }
          );
        });
      }

      // =====================
      // METRICS (UNCHANGED)
      // =====================
      let counter =
        post.querySelector(".linkdown-metrics-count");

      if (!counter) {
        const reactions =
          post.querySelector(".social-details-social-counts");
        const targetLi =
          reactions?.querySelector("li[class^='social-details']");

        if (targetLi) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className =
            "t-black--light display-flex align-items-center " +
            "social-details-social-counts__count-value " +
            "text-body-small hoverable-link-text linkdown-downvote-metrics";
          btn.style.marginLeft = "10px";
          btn.style.cursor = "unset";
          btn.style.display = "flex";
          btn.style.alignItems = "center";
          btn.style.gap = "4px";

          const img = document.createElement("img");
          img.src =
            "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><text y='14' font-size='14'>👎</text></svg>";
          img.alt = "downvote";

          counter = document.createElement("span");
          counter.className =
            "social-details-social-counts__reactions-count linkdown-metrics-count";
          counter.style.fontWeight = "bold";
          counter.textContent = "0";

          btn.appendChild(img);
          btn.appendChild(counter);
          targetLi.appendChild(btn);

          updateDislikeCount(post, postId, counter);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

// =========================
// OBSERVER (NO SCROLL HACK)
// =========================
const observer = new MutationObserver(() => {
  processPosts().catch(console.error);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial run
processPosts().catch(console.error);
