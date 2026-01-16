document.addEventListener('DOMContentLoaded', async () => {
  const countElem = document.getElementById('downvoteCount');
  countElem.textContent = 'Loading...';

  try {
    const client_id = await getClientId();
    console.log('[Downvote Tracker] Client ID:', client_id);

    chrome.runtime.sendMessage(
      { action: 'get-client-downvotes-today', client_id },
      (response) => {
        console.log('[Downvote Tracker] API Response:', response);

        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          countElem.textContent = 'Error';
          return;
        }

        const today = response?.downvotes_today ?? 0;
        countElem.textContent = today;
        countElem.classList.remove('pulse');
        chrome.storage.local.set({ downvotesToday: today });
      }
    );

    setTimeout(() => {
      if (countElem.textContent === 'Loading...') {
        countElem.textContent = '?';
        console.warn('Timeout – keine Serverantwort');
      }
    }, 5000);

  } catch (err) {
    console.error('[Downvote Tracker] Init error:', err);
    countElem.textContent = 'Error';
  }
});

async function getClientId() {
  let { client_id } = await chrome.storage.local.get(['client_id']);
  if (!client_id) {
    client_id = crypto.randomUUID();
    await chrome.storage.local.set({ client_id });
  }
  return client_id;
}

document.getElementById('feature-request').addEventListener("click", () => {
  window.open("https://forms.gle/WiujCM52dckbAPNy8", "_blank");
})

document.getElementById('report-bug').addEventListener("click", () => {
  window.open("https://forms.gle/kYXTwLcuQ7eLPXo57", "_blank");
})

document.addEventListener("DOMContentLoaded", () => {
  const shareBtn = document.getElementById("share-extension");

  if (!shareBtn) return;

  const shareUrl =
    "https://chromewebstore.google.com/detail/linkedin-downvote-for-lin/cmnmohlcnjkoodfpjplhmmfldgacgjoh?authuser=1&hl=de";

  shareBtn.addEventListener("click", async () => {
    // 1. Try native share (best UX)
    if (navigator.share) {
      try {
        await navigator.share({
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled → fallback silently
      }
    }

    // 2. Clipboard fallback
    try {
      await navigator.clipboard.writeText(`${shareUrl}`);
      showShareFeedback("Link copied!");
    } catch {
      showShareFeedback("Copy failed 😢");
    }
  });

  function showShareFeedback(text) {
    const original = shareBtn.querySelector("span");
    const prev = original.textContent;

    original.textContent = text;

    setTimeout(() => {
      original.textContent = prev;
    }, 1500);
  }
});
