import { triggerBadgeFeedback } from "../../shared/utils/ui-feedback.js";

function fakeFillerEngine() {
  const inputs = document.querySelectorAll("input, textarea, select");

  const dummyData = {
    name: ["Ojan Haris", "Fauzan Hasyim", "Devkita Tester", "John Doe"],
    email: ["test@example.com", "dev@devkita.id", "ojan@mail.com"],
    phone: ["081234567890", "085712345678"],
    address: ["Jl. Slamet Riyadi No. 1, Solo", "Karanganyar, Central Java"],
    lorem:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  };

  const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  inputs.forEach((el) => {
    // Lewati elemen yang tersembunyi atau tidak bisa diedit
    if (el.disabled || el.readOnly || el.type === "hidden") return;

    const name = (el.name || el.id || el.placeholder || "").toLowerCase();
    const type = el.type;

    if (type === "text" || type === "textarea") {
      if (name.includes("name")) el.value = getRandom(dummyData.name);
      else if (name.includes("mail")) el.value = getRandom(dummyData.email);
      else if (name.includes("phone") || name.includes("tel"))
        el.value = getRandom(dummyData.phone);
      else if (name.includes("address"))
        el.value = getRandom(dummyData.address);
      else el.value = "Test Input " + Math.floor(Math.random() * 100);

      if (el.tagName === "TEXTAREA") el.value = dummyData.lorem;
    } else if (type === "email") el.value = getRandom(dummyData.email);
    else if (type === "tel") el.value = getRandom(dummyData.phone);
    else if (type === "number") el.value = Math.floor(Math.random() * 1000);
    else if (type === "password") el.value = "Password123!";
    else if (type === "checkbox" || type === "radio") el.checked = true;
    else if (el.tagName === "SELECT") {
      if (el.options.length > 1) el.selectedIndex = 1;
    }

    // Trigger event agar framework (seperti React/Vue) mendeteksi perubahan input
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function handleFakeFillerMenu(info, tab) {
  if (info.menuItemId === "fake-filler") {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fakeFillerEngine,
    });
    triggerBadgeFeedback(tab.id, "Filled", "#ffc107");
  }
}
