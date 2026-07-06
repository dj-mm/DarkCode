/* DarkCode Part 1C - UI Effects + Key Based Encoder */

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const secretKey = $("#secretKey");
  const inputText = $("#inputText");
  const outputText = $("#outputText");
  const encodeBtn = $("#encodeBtn");
  const decodeBtn = $("#decodeBtn");
  const copyBtn = $("#copyBtn");
  const downloadBtn = $("#downloadBtn");
  const shareBtn = $("#shareBtn");
  const clearBtn = $("#clearBtn");
  const swapBtn = $("#swapBtn");
  const toggleKeyBtn = $("#toggleKeyBtn");
  const clearHistoryBtn = $("#clearHistoryBtn");
  const historyList = $("#historyList");
  const charCount = $("#charCount");
  const wordCount = $("#wordCount");
  const navbar = $(".navbar");

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8", { fatal: true });
  const MAGIC = [68, 67, 49, 58]; // DC1:
  const STORAGE_KEY = "darkcode_recent_history_v1";

  const symbolRanges = [
    [0x2600, 0x26ff],
    [0x2701, 0x27bf],
    [0x2190, 0x21ff],
    [0x2200, 0x22ff],
    [0x2300, 0x23ff],
    [0x25a0, 0x25ff],
    [0x29c0, 0x29ff],
    [0x2b00, 0x2bff],
    [0x1f300, 0x1f32f],
    [0x1f500, 0x1f53f],
    [0x1f700, 0x1f77f]
  ];

  const blockedSymbols = new Set([
    "©", "®", "™", "ℹ", "↩", "↪", "⌚", "⌛", "⏩", "⏪", "⏫", "⏬", "⏰", "⏳"
  ]);

  const makeSymbolPool = () => {
    const pool = [];
    const seen = new Set();

    symbolRanges.forEach(([start, end]) => {
      for (let codePoint = start; codePoint <= end; codePoint += 1) {
        const symbol = String.fromCodePoint(codePoint);
        if (!seen.has(symbol) && !blockedSymbols.has(symbol)) {
          seen.add(symbol);
          pool.push(symbol);
        }
      }
    });

    return pool;
  };

  const SYMBOL_POOL = makeSymbolPool();

  const hashString = (value) => {
    let hash = 2166136261;
    for (const char of value) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const createRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let next = state;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  };

  const shuffleWithSeed = (items, seed) => {
    const shuffled = [...items];
    const random = createRandom(seed);

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  };

  const createCodebook = (key) => {
    const seed = hashString(`DarkCode::${key}`);
    const selectedSymbols = shuffleWithSeed(SYMBOL_POOL, seed).slice(0, 256);
    const byteToSymbol = new Map();
    const symbolToByte = new Map();

    selectedSymbols.forEach((symbol, byte) => {
      byteToSymbol.set(byte, symbol);
      symbolToByte.set(symbol, byte);
    });

    return { byteToSymbol, symbolToByte };
  };

  const checksumBytes = (message, key) => {
    const hash = hashString(`${key}::${message}::DarkCode`);
    return [
      (hash >>> 24) & 255,
      (hash >>> 16) & 255,
      (hash >>> 8) & 255,
      hash & 255
    ];
  };

  const sameBytes = (first, second) => {
    if (first.length !== second.length) return false;
    return first.every((byte, index) => byte === second[index]);
  };

  const encodeMessage = (message, key) => {
    const { byteToSymbol } = createCodebook(key);
    const messageBytes = Array.from(textEncoder.encode(message));
    const payload = [...MAGIC, ...checksumBytes(message, key), ...messageBytes];
    return payload.map((byte) => byteToSymbol.get(byte)).join("");
  };

  const decodeMessage = (darkCode, key) => {
    const { symbolToByte } = createCodebook(key);
    const symbols = Array.from(darkCode).filter((symbol) => !/\s/.test(symbol));
    const bytes = symbols.map((symbol) => symbolToByte.get(symbol));

    if (!bytes.length) {
      throw new Error("DarkCode input is empty.");
    }

    if (bytes.some((byte) => byte === undefined)) {
      throw new Error("This code does not match the current secret key.");
    }

    if (!sameBytes(bytes.slice(0, MAGIC.length), MAGIC)) {
      throw new Error("Wrong secret key or invalid DarkCode.");
    }

    const savedChecksum = bytes.slice(MAGIC.length, MAGIC.length + 4);
    const messageBytes = bytes.slice(MAGIC.length + 4);
    let message = "";

    try {
      message = textDecoder.decode(new Uint8Array(messageBytes));
    } catch {
      throw new Error("The secret key is wrong or the DarkCode is invalid.");
    }

    const currentChecksum = checksumBytes(message, key);

    if (!sameBytes(savedChecksum, currentChecksum)) {
      throw new Error("The secret key is wrong or the code has been modified.");
    }

    return message;
  };

  const showToast = (message, type = "info") => {
    let toast = $(".toast-box");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast-box";
      document.body.appendChild(toast);
    }

    const colors = {
      info: "#00f7ff",
      success: "#35ff9e",
      warning: "#ffd166",
      error: "#ff4f6d"
    };

    toast.style.borderLeftColor = colors[type] || colors.info;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  };

  const updateCounters = () => {
    const value = inputText.value;
    charCount.textContent = value.length;
    wordCount.textContent = value.trim() ? value.trim().split(/\s+/).length : 0;

    const lineCount = $("#lineCount");
    if (lineCount) {
      lineCount.textContent = value ? value.split(/\r\n|\r|\n/).length : 0;
    }
  };

  const requireFields = () => {
    if (!secretKey.value.trim()) {
      secretKey.focus();
      showToast("Please enter a secret key.", "warning");
      return false;
    }

    if (!inputText.value.trim()) {
      inputText.focus();
      showToast("Please enter a message.", "warning");
      return false;
    }

    return true;
  };

  const saveHistory = (mode, input, output) => {
    let history = [];

    try {
      history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      history = [];
    }

    history.unshift({
      mode,
      input,
      output,
      time: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
    renderHistory();
  };

  const runEncode = () => {
    if (!requireFields()) return;

    outputText.value = encodeMessage(inputText.value, secretKey.value);
    saveHistory("encode", inputText.value, outputText.value);
    showToast("Message encoded into DarkCode.", "success");
  };

  const runDecode = () => {
    if (!requireFields()) return;

    try {
      outputText.value = decodeMessage(inputText.value, secretKey.value);
      saveHistory("decode", inputText.value, outputText.value);
      showToast("DarkCode decoded successfully.", "success");
    } catch (error) {
      outputText.value = "";
      showToast(error.message, "error");
    }
  };

  const copyOutput = async () => {
    if (!outputText.value.trim()) {
      showToast("There is no output to copy.", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText.value);
      showToast("Output copied to clipboard.", "success");
    } catch {
      outputText.select();
      document.execCommand("copy");
      showToast("Output copied.", "success");
    }
  };

  const downloadOutput = () => {
    if (!outputText.value.trim()) {
      showToast("There is no output to download.", "warning");
      return;
    }

    const blob = new Blob([outputText.value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `darkcode-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("TXT file downloaded.", "success");
  };

  const shareOutput = async () => {
    if (!outputText.value.trim()) {
      showToast("There is no output to share.", "warning");
      return;
    }

    if (!navigator.share) {
      await copyOutput();
      showToast("Sharing is not available here, so the output was copied.", "info");
      return;
    }

    try {
      await navigator.share({
        title: "DarkCode v1.0",
        text: outputText.value
      });
    } catch {
      showToast("Sharing was cancelled.", "warning");
    }
  };

  const clearAll = () => {
    inputText.value = "";
    outputText.value = "";
    updateCounters();
    inputText.focus();
    showToast("Workspace cleared.", "info");
  };

  const swapInputOutput = () => {
    if (!outputText.value.trim()) {
      showToast("There is no output to swap.", "warning");
      return;
    }

    [inputText.value, outputText.value] = [outputText.value, inputText.value];
    updateCounters();
    showToast("Input and output swapped.", "info");
  };

  const loadHistory = () => {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  };

  const clipText = (value, maxLength = 140) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  };

  const renderHistory = () => {
    if (!historyList) return;

    const history = loadHistory();

    if (!history.length) {
      historyList.innerHTML = '<div class="history-empty">No recent activity yet. Encode or decode a message to create history.</div>';
      return;
    }

    historyList.innerHTML = history.map((item, index) => {
      const time = new Date(item.time).toLocaleString();
      const preview = clipText(item.output || item.input || "");
      return `
        <article class="history-item">
          <div class="history-meta">
            <span class="history-mode">${item.mode || "activity"}</span>
            <span class="history-time">${time}</span>
          </div>
          <p class="history-preview">${preview.replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
          })[char])}</p>
          <div class="history-actions">
            <button class="btn btn-sm btn-outline-info" type="button" data-history-load="${index}">
              <i class="fa-solid fa-arrow-up-from-bracket"></i> Load Output
            </button>
            <button class="btn btn-sm btn-outline-light" type="button" data-history-copy="${index}">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
          </div>
        </article>
      `;
    }).join("");
  };

  const setupHistory = () => {
    renderHistory();

    historyList?.addEventListener("click", async (event) => {
      const loadButton = event.target.closest("[data-history-load]");
      const copyButton = event.target.closest("[data-history-copy]");
      const history = loadHistory();

      if (loadButton) {
        const item = history[Number(loadButton.dataset.historyLoad)];
        if (!item) return;

        inputText.value = item.input || "";
        outputText.value = item.output || "";
        updateCounters();
        document.querySelector("#workspace")?.scrollIntoView({ behavior: "smooth" });
        showToast("History item loaded into the workspace.", "success");
      }

      if (copyButton) {
        const item = history[Number(copyButton.dataset.historyCopy)];
        if (!item?.output) return;

        try {
          await navigator.clipboard.writeText(item.output);
          showToast("History output copied to clipboard.", "success");
        } catch {
          showToast("Could not copy this history item.", "error");
        }
      }
    });

    clearHistoryBtn?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
      showToast("History cleared.", "info");
    });
  };

  const setupKeyToggle = () => {
    toggleKeyBtn?.addEventListener("click", () => {
      const shouldShow = secretKey.type === "password";
      secretKey.type = shouldShow ? "text" : "password";
      toggleKeyBtn.innerHTML = shouldShow
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
      showToast(shouldShow ? "Secret key is visible." : "Secret key is hidden.", "info");
    });
  };

  const addCyberElements = () => {
    if (!$(".cyber-orb")) {
      document.body.insertAdjacentHTML(
        "afterbegin",
        '<div class="cyber-orb orb1"></div><div class="cyber-orb orb2"></div><div id="cursorGlow"></div>'
      );
    }

    if (!$("#loadingScreen")) {
      document.body.insertAdjacentHTML(
        "afterbegin",
        '<div id="loadingScreen"><div class="loader-ring"></div><div class="loader-title">DARKCODE</div></div>'
      );
    }

    const particleLayer = document.createElement("div");
    particleLayer.id = "particleLayer";
    particleLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(particleLayer);

    const style = document.createElement("style");
    style.textContent = `
      #particleLayer{position:fixed;inset:0;pointer-events:none;z-index:-1;overflow:hidden}
      .dc-particle{position:absolute;width:2px;height:2px;border-radius:50%;background:#00f7ff;box-shadow:0 0 10px #00f7ff;opacity:.55;animation:dcFloat linear infinite}
      @keyframes dcFloat{from{transform:translateY(105vh);opacity:0}15%,80%{opacity:.55}to{transform:translateY(-10vh);opacity:0}}
      .typing-caret::after{content:"|";color:#00f7ff;animation:dcBlink .8s infinite}
      @keyframes dcBlink{50%{opacity:0}}
    `;
    document.head.appendChild(style);

    for (let index = 0; index < 48; index += 1) {
      const particle = document.createElement("span");
      particle.className = "dc-particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDuration = `${6 + Math.random() * 9}s`;
      particle.style.animationDelay = `${Math.random() * 8}s`;
      particleLayer.appendChild(particle);
    }
  };

  const setupEffects = () => {
    const loadingScreen = $("#loadingScreen");
    const cursorGlow = $("#cursorGlow");
    const heroText = $(".hero p");
    const originalHeroText = heroText?.textContent.trim();
    const navLinks = $$(".nav-link[href^='#']");
    const sections = navLinks
      .map((link) => $(link.getAttribute("href")))
      .filter(Boolean);

    window.addEventListener("load", () => {
      if (!loadingScreen) return;
      setTimeout(() => {
        loadingScreen.style.opacity = "0";
        loadingScreen.style.transition = ".45s";
        setTimeout(() => loadingScreen.remove(), 500);
      }, 650);
    });

    window.addEventListener("scroll", () => {
      navbar?.classList.toggle("scrolled", window.scrollY > 20);

      const visibleSections = sections.filter((section) => section.getBoundingClientRect().top <= 130);
      const activeSection = visibleSections[visibleSections.length - 1];

      navLinks.forEach((link) => {
        link.classList.toggle("active", activeSection && link.getAttribute("href") === `#${activeSection.id}`);
      });
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const navMenu = $("#navMenu");
        if (navMenu?.classList.contains("show") && window.bootstrap) {
          window.bootstrap.Collapse.getOrCreateInstance(navMenu).hide();
        }
      });
    });

    window.addEventListener("mousemove", (event) => {
      if (!cursorGlow) return;
      cursorGlow.style.left = `${event.clientX}px`;
      cursorGlow.style.top = `${event.clientY}px`;
    });

    if (heroText && originalHeroText) {
      heroText.textContent = "";
      heroText.classList.add("typing-caret");
      let index = 0;
      const timer = setInterval(() => {
        heroText.textContent = originalHeroText.slice(0, index);
        index += 1;

        if (index > originalHeroText.length) {
          clearInterval(timer);
          heroText.classList.remove("typing-caret");
        }
      }, 28);
    }
  };

  const setupShortcuts = () => {
    document.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      if (key === "enter") {
        event.preventDefault();
        runEncode();
      }

      if (key === "d") {
        event.preventDefault();
        runDecode();
      }

      if (key === "k") {
        event.preventDefault();
        clearAll();
      }
    });
  };

  const init = () => {
    if (!secretKey || !inputText || !outputText || !encodeBtn || !decodeBtn) {
      console.error("DarkCode: required HTML elements missing.");
      return;
    }

    addCyberElements();
    setupEffects();
    setupShortcuts();
    setupHistory();
    setupKeyToggle();

    inputText.addEventListener("input", updateCounters);
    encodeBtn.addEventListener("click", runEncode);
    decodeBtn.addEventListener("click", runDecode);
    copyBtn?.addEventListener("click", copyOutput);
    downloadBtn?.addEventListener("click", downloadOutput);
    shareBtn?.addEventListener("click", shareOutput);
    clearBtn?.addEventListener("click", clearAll);
    swapBtn?.addEventListener("click", swapInputOutput);
    updateCounters();
  };

  init();
})();
