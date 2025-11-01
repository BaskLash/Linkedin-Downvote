document.querySelectorAll(".feed-shared-social-action-bar").forEach(bar => {
  // Create span
  const span = document.createElement("span");
  span.className = "reactions-react-button feed-shared-social-action-bar__action-button feed-shared-social-action-bar--new-padding";

  // Create button
  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = "👎";
  button.title = "Dislike";
  button.className = "artdeco-button artdeco-button--muted artdeco-button--3 artdeco-button--tertiary ember-view social-actions-button react-button__trigger";
  
  // Optional: Text "Dislike" daneben
  const label = document.createElement("span");
  label.textContent = "Dislike";
  label.style.marginLeft = "6px";
  label.style.fontSize = "14px";
  label.style.color = "#666666";

button.appendChild(label);

  // Append button to span
  span.appendChild(button);

  // Insert span as the first child
  bar.insertBefore(span, bar.firstChild);
});
