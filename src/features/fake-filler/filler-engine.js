import { triggerBadgeFeedback } from "../../shared/utils/ui-feedback.js";

/**
 * Core Engine yang diinjeksi ke dalam DOM halaman.
 * Fungsi ini harus berifat self-contained (tidak memiliki dependensi eksternal) 
 * karena dieksekusi di isolated environment melalui chrome.scripting.
 */
function fakeFillerEngine(customConfig = {}) {
  // --- 1. Data Generators (Internal Faker) ---
  const generators = {
    firstName: () => {
      const names = ["Fauzan", "Budi", "Sarah", "John", "Doe", "Jane", "Alice", "Bob", "Charlie", "Diana"];
      return names[Math.floor(Math.random() * names.length)];
    },
    lastName: () => {
      const names = ["Hasyim", "Wijaya", "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia"];
      return names[Math.floor(Math.random() * names.length)];
    },
    company: () => ["Devkita", "TechCorp", "InnoSystems", "GlobalNet"][Math.floor(Math.random() * 4)],
    email: (fname, lname) => `${fname.toLowerCase()}.${lname.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`,
    phone: () => "08" + Math.floor(Math.random() * 10000000000).toString().padStart(10, "0"),
    address: () => `${Math.floor(Math.random() * 100) + 1} Main Street, Suite ${Math.floor(Math.random() * 100)}`,
    city: () => ["Solo", "Karanganyar", "Jakarta", "Bandung", "Surabaya"][Math.floor(Math.random() * 5)],
    zip: () => Math.floor(10000 + Math.random() * 90000).toString(),
    website: () => `https://www.example-${Math.floor(Math.random() * 1000)}.com`,
    paragraph: () => "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi.",
    number: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
    date: () => {
      const start = new Date(1980, 0, 1);
      const end = new Date(2005, 11, 31);
      return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
    }
  };

  // --- 2. Rule Engine (Konfigurasi Pola Matcher) ---
  const defaultRules = [
    { match: /first.?name|fname/i, type: 'text', generate: generators.firstName },
    { match: /last.?name|lname/i, type: 'text', generate: generators.lastName },
    { match: /name|fullname/i, type: 'text', generate: () => `${generators.firstName()} ${generators.lastName()}` },
    { match: /company|organization|biz/i, type: 'text', generate: generators.company },
    { match: /e.?mail/i, type: 'text', generate: () => generators.email(generators.firstName(), generators.lastName()) },
    { match: /phone|tel|mobile/i, type: 'text', generate: generators.phone },
    { match: /address|street/i, type: 'text', generate: generators.address },
    { match: /city|town/i, type: 'text', generate: generators.city },
    { match: /zip|postal/i, type: 'text', generate: generators.zip },
    { match: /url|website|site/i, type: 'text', generate: generators.website },
    { match: /date|dob|birth/i, type: 'text', generate: generators.date },
  ];

  // Gabungkan rules bawaan dengan custom config (jika ada dari parameter)
  const rules = [...(customConfig.rules || []), ...defaultRules];

  // --- 3. DOM Utilities & Framework Bypasser ---

  // React/Vue sering melakukan override pada setter 'value' di level prototipe.
  // Kita perlu memanggil native setter agar framework mendeteksi perubahan.
  const setNativeValue = (element, value) => {
    let prototype = Object.getPrototypeOf(element);
    let descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    // Fallback traversal prototype chain jika descriptor tidak ditemukan
    while (!descriptor && prototype !== null) {
      prototype = Object.getPrototypeOf(prototype);
      if (prototype) descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    }

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  // --- 4. Input Processing Logic ---

  const isInteractable = (el) => {
    const isHidden = el.type === 'hidden' || el.style.display === 'none' || el.style.visibility === 'hidden';
    return !el.disabled && !el.readOnly && !isHidden;
  };

  const enforceConstraints = (el, val) => {
    let result = String(val);
    if (el.maxLength && el.maxLength > 0) {
      result = result.substring(0, el.maxLength);
    }
    return result;
  };

  const processInput = (el) => {
    if (!isInteractable(el)) return;

    const aggregateIdentifier = [el.name, el.id, el.placeholder, el.getAttribute('aria-label')].filter(Boolean).join(' ');

    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options).filter(opt => !opt.disabled && opt.value !== "");
      if (options.length > 0) {
        el.selectedIndex = options[Math.floor(Math.random() * options.length)].index;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    if (el.type === 'checkbox' || el.type === 'radio') {
      // Untuk radio, hindari men-check semua opsi dengan name yang sama
      if (el.type === 'radio') {
        const siblings = document.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
        if (siblings.length > 0) {
          const randomNode = siblings[Math.floor(Math.random() * siblings.length)];
          if (randomNode !== el && randomNode.checked) return; // Sudah ada yang ter-check
        }
      }
      el.checked = Math.random() > 0.5 || el.required; // Default: 50% chance, kecuali required
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    let generatedValue = null;

    // Evaluasi spesifik berdasarkan input type bawaan HTML5
    if (el.type === 'email') generatedValue = generators.email(generators.firstName(), generators.lastName());
    else if (el.type === 'number') {
      const min = el.min ? parseFloat(el.min) : 0;
      const max = el.max ? parseFloat(el.max) : 1000;
      generatedValue = generators.number(min, max);
    }
    else if (el.type === 'tel') generatedValue = generators.phone();
    else if (el.type === 'url') generatedValue = generators.website();
    else if (el.type === 'date') generatedValue = generators.date();
    else if (el.type === 'password') generatedValue = "TestPass!234"; // Default static complex password

    // Jika tidak tertangkap type spesifik, gunakan Regex Rule Engine
    if (!generatedValue) {
      for (const rule of rules) {
        if (rule.match.test(aggregateIdentifier)) {
          generatedValue = rule.generate();
          break;
        }
      }
    }

    // Fallback terakhir berdasarkan tag
    if (!generatedValue) {
      generatedValue = el.tagName === 'TEXTAREA' ? generators.paragraph() : generators.firstName();
    }

    // Terapkan value dengan menghormati max-length dan trigger state management framework
    setNativeValue(el, enforceConstraints(el, generatedValue));
  };

  // --- 5. Main Execution ---
  document.querySelectorAll('input, select, textarea').forEach(processInput);
}

// Handler eksekusi dari background/context-menu
export async function handleFakeFillerMenu(info, tab) {
  if (info.menuItemId === "fake-filler") {
    // Kita bisa mengambil konfigurasi user (misalnya custom rules dari local storage) 
    // dan mengirimkannya sebagai argument ke engine.
    const customConfig = {};

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fakeFillerEngine,
      args: [customConfig] // Passing data dari service worker ke isolated page environment
    });

    triggerBadgeFeedback(tab.id, "Filled", "#ffc107");
  }
}