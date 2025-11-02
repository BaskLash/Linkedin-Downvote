chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const actions = ["dislike", "undislike", "get-dislike-count"];
  if (!actions.includes(msg.action)) return;

  if (msg.action === "get-dislike-count") {
    fetch(`https://linkedin.prompt-in.com/index.php?route=dislike-count&post_id=${encodeURIComponent(msg.post_id)}`)
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(() => sendResponse({ dislike_count: 0 }));
    return true;
  }

  // dislike / undislike
  fetch(`https://linkedin.prompt-in.com/index.php?route=${msg.action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: msg.post_id, client_id: msg.client_id })
  })
  .then(r => r.json())
  .then(data => sendResponse(data))
  .catch(err => sendResponse({ success: false, message: err.message }));

  return true;
});