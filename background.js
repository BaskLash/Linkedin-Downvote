chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "dislike") {
    // WICHTIG: return true VOR async Operation
    fetch(`http://localhost:8080/index.php?route=dislike`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: msg.post_id, client_id: msg.client_id })
    })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, message: err.message }));

    return true; // hält Kanal offen
  }

  // Optional: dislike-count abfragen
  if (msg.action === "get-dislike-count") {
    fetch(`http://localhost:8080/index.php?route=dislike-count&post_id=${encodeURIComponent(msg.post_id)}`)
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ dislike_count: 0 }));

    return true;
  }
  console.log("Background: Dislike request for post", msg.post_id);
});