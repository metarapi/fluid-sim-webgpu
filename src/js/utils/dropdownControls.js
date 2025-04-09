export function setupGridDropdown(
  menuId,
  buttonId,
  selectedDisplayId,
  onUpdate
) {
  const menu = document.getElementById(menuId);
  const button = document.getElementById(buttonId);
  const selectedDisplay = document.getElementById(selectedDisplayId);

  button.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });

  menu.querySelectorAll("button").forEach((option) => {
    option.addEventListener("click", () => {
      const label = option.textContent.trim();
      selectedDisplay.textContent = label;
      menu.classList.add("hidden");
      const numericValue = parseInt(label);
      // console.log("Grid size selected:", numericValue);
      if (onUpdate) onUpdate(numericValue);
    });
  });

  return (e) => {
    if (!button.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add("hidden");
    }
  };
}

export function setupParticleDropdown(
  menuId,
  buttonId,
  selectedDisplayId,
  onUpdate
) {
  const menu = document.getElementById(menuId);
  const button = document.getElementById(buttonId);
  const selectedDisplay = document.getElementById(selectedDisplayId);

  button.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });

  menu.querySelectorAll("button").forEach((option) => {
    option.addEventListener("click", () => {
      const label = option.textContent.trim();
      selectedDisplay.textContent = label;
      menu.classList.add("hidden");
      const numericValue = parseInt(option.getAttribute("data-value"));
      // console.log("Particle count selected:", numericValue);
      if (onUpdate) onUpdate(numericValue);
    });
  });

  return (e) => {
    if (!button.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add("hidden");
    }
  };
}
