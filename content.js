// === LinkedIn Dislike Extension – content.js ===
// RYD-style dislike estimation (DISPLAY ONLY)

const processedPosts = new WeakSet();
const SMOOTHING = 20;
const ACTIVE_COLOR = "#0a66c2"; // LinkedIn Blue

// === Utils ===
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

// === Robust Post-ID Detection ===
function extractPostId(postElement) {
  const urnRegex = /urn:li:(?:activity|share):(\d+)/i;
  let current = postElement;

  while (current && current !== document.body) {
    if (current.dataset?.urn) {
      const m = current.dataset.urn.match(urnRegex);
      if (m) return m[1];
    }
    current = current.parentElement;
  }

  const link = postElement.querySelector('a[href*="/activity/"], a[href*="/posts/"]');
  if (link?.href) {
    const m = link.href.match(/activity[/-](\d+)/i);
    if (m) return m[1];
  }

  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// === Client-ID ===
async function getClientId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['client_id'], (r) => {
      if (r.client_id) return resolve(r.client_id);
      const id = crypto.randomUUID();
      chrome.storage.local.set({ client_id: id }, () => resolve(id));
    });
  });
}

// === Vote State Storage ===
async function getVotedPosts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['linkdown-voted'], (r) => {
      resolve(r['linkdown-voted'] || []);
    });
  });
}

async function setPostVoted(postId, voted) {
  const votedPosts = await getVotedPosts();
  const has = votedPosts.includes(postId);

  let updated;
  if (voted && !has) {
    updated = [...votedPosts, postId];
  } else if (!voted && has) {
    updated = votedPosts.filter(id => id !== postId);
  } else {
    return;
  }

  return chrome.storage.local.set({ 'linkdown-voted': updated });
}

// === UI State ===
function applyDownvoteStyle(button, isActive) {
  button.style.color = isActive ? ACTIVE_COLOR : "";
  button.style.fontWeight = isActive ? "600" : "";
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
}

// === Server Count → Display Logic ===
function updateDislikeCount(post, postId, counter) {
  if (!counter) return;

  chrome.runtime.sendMessage(
    { action: "get-dislike-count", post_id: postId },
    (response) => {
      const raw = response?.dislike_count ?? 0;

      const reactionSpan = post.querySelector(
        "span.social-details-social-counts__reactions-count"
      );

      const totalReactions = parseReactionCount(reactionSpan?.innerText);
      const displayed = estimateDisplayedDislikes(raw, totalReactions);

      counter.textContent = displayed;
      counter.dataset.raw = raw;
    }
  );
}

// === Main Processor ===
async function processPosts() {
  const bars = document.querySelectorAll(".feed-shared-social-action-bar");

  for (const bar of bars) {
    const post = bar.closest("div.feed-shared-update-v2, article, .occludable-update");
    if (!post || processedPosts.has(post)) continue;
    processedPosts.add(post);

    const postId = extractPostId(post);
    const clientId = await getClientId();

    // =========================
    // 1️⃣ Downvote Button (IMMER)
    // =========================
    if (!bar.querySelector("[data-linkdown]")) {
      const span = document.createElement("span");
      span.className =
        "reactions-react-button feed-shared-social-action-bar__action-button";

      const btn = document.createElement("button");
      btn.dataset.linkdown = "true";
      btn.className =
        "artdeco-button artdeco-button--muted artdeco-button--tertiary";
      btn.innerHTML = "👎 Downvote";
      btn.title = "Downvote";

      span.appendChild(btn);
      bar.insertBefore(span, bar.firstChild);

      const votedPosts = await getVotedPosts();
      let isDownvoted = votedPosts.includes(postId);
      applyDownvoteStyle(btn, isDownvoted);

      btn.addEventListener("click", async () => {
        btn.disabled = true;

        const action = isDownvoted ? "undislike" : "dislike";

        chrome.runtime.sendMessage(
          { action, post_id: postId, client_id: clientId },
          async (response) => {
            btn.disabled = false;
            if (!response?.success) return;

            isDownvoted = !isDownvoted;
            await setPostVoted(postId, isDownvoted);
            applyDownvoteStyle(btn, isDownvoted);

            const counter = post.querySelector(".linkdown-metrics-count");
            updateDislikeCount(post, postId, counter);
          }
        );
      });
    }

    // ===================================
    // 2️⃣ Metrics (NUR WENN MÖGLICH)
    // ===================================
    let counter = post.querySelector(".linkdown-metrics-count");
    if (!counter) {
      const reactionsContainer = post.querySelector(".social-details-social-counts");
      const targetLi = reactionsContainer?.querySelector("li[class^='social-details']");

      if (targetLi) {

const btn = document.createElement("button");
btn.type = "button";
btn.setAttribute("aria-label", "0 downvotes");
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
}

// === Scroll Observer ===
let t;
window.addEventListener("scroll", () => {
  clearTimeout(t);
  t = setTimeout(processPosts, 100);
});

processPosts();
