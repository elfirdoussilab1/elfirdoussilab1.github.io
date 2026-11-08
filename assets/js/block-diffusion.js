/*
 * Block-diffusion text decoding.
 *
 * The text inside [data-diffuse] is split into word tokens. Every token starts
 * masked; blocks of BLOCK_SIZE tokens are then decoded left to right
 * (semi-autoregressively), and inside a block the tokens are unmasked in a
 * random order over STEPS denoising steps, as in masked / block diffusion
 * language models.
 *
 * Without JavaScript, or with reduced motion requested, the text is shown as is.
 */
(function () {
  "use strict";

  var BLOCK_SIZE = 16;   // tokens per block
  var STEPS = 4;         // denoising steps per block
  var STEP_MS = 75;      // delay between denoising steps
  var BLOCK_GAP_MS = 45; // pause between blocks
  var FRESH_MS = 650;    // how long a newly decoded token stays highlighted

  var root = document.querySelector("[data-diffuse]");
  if (!root) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showPlain() {
    root.classList.add("is-ready");
  }

  if (reduceMotion || !document.createTreeWalker) {
    showPlain();
    return;
  }

  var controls = document.querySelector("[data-diffuse-controls]");
  var statusEl = document.querySelector("[data-diffuse-status]");
  var replayBtn = document.querySelector("[data-diffuse-replay]");

  /* 1. Tokenise: wrap each word in a span, keeping links and emphasis intact. */
  var textNodes = [];
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue.trim()) textNodes.push(walker.currentNode);
  }

  var tokens = [];
  textNodes.forEach(function (node) {
    var frag = document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        return;
      }
      var span = document.createElement("span");
      span.className = "tok";
      span.textContent = part;
      frag.appendChild(span);
      tokens.push(span);
    });
    node.parentNode.replaceChild(frag, node);
  });

  if (!tokens.length) {
    showPlain();
    return;
  }

  var links = Array.prototype.map.call(root.querySelectorAll("a"), function (a) {
    return { el: a, toks: Array.prototype.slice.call(a.querySelectorAll(".tok")) };
  });

  var blocks = [];
  for (var i = 0; i < tokens.length; i += BLOCK_SIZE) {
    blocks.push(tokens.slice(i, i + BLOCK_SIZE));
  }

  /* 2. Scheduling helpers. */
  var timers = [];

  function later(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers = [];
  }

  function shuffle(arr) {
    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = arr[j];
      arr[j] = arr[k];
      arr[k] = tmp;
    }
    return arr;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function isMasked(tok) {
    return tok.classList.contains("is-masked");
  }

  function updateLinks() {
    links.forEach(function (link) {
      if (!link.el.classList.contains("is-decoded") && !link.toks.some(isMasked)) {
        link.el.classList.add("is-decoded");
      }
    });
  }

  function reveal(tok) {
    tok.classList.remove("is-masked", "is-active");
    tok.classList.add("is-fresh");
    later(function () { tok.classList.remove("is-fresh"); }, FRESH_MS);
  }

  function maskAll() {
    tokens.forEach(function (tok) {
      tok.classList.remove("is-active", "is-fresh");
      tok.classList.add("is-masked");
    });
    links.forEach(function (link) { link.el.classList.remove("is-decoded"); });
    root.classList.add("is-diffusing");
  }

  /* 3. Decode block by block; random unmasking order within each block. */
  function run() {
    clearTimers();
    maskAll();

    var t = 200;
    blocks.forEach(function (block, b) {
      later(function () {
        block.forEach(function (tok) { tok.classList.add("is-active"); });
        setStatus("block " + (b + 1) + "/" + blocks.length + " · step 0/" + STEPS);
      }, t);

      var order = shuffle(block.slice());
      for (var s = 0; s < STEPS; s++) {
        var chunk = order.slice(
          Math.floor((s * order.length) / STEPS),
          Math.floor(((s + 1) * order.length) / STEPS)
        );
        t += STEP_MS;
        later((function (chunk, s) {
          return function () {
            chunk.forEach(reveal);
            updateLinks();
            setStatus("block " + (b + 1) + "/" + blocks.length + " · step " + (s + 1) + "/" + STEPS);
          };
        })(chunk, s), t);
      }
      t += BLOCK_GAP_MS;
    });

    later(function () {
      root.classList.remove("is-diffusing");
      setStatus(tokens.length + " tokens · " + blocks.length + " blocks × " + STEPS + " steps");
    }, t + FRESH_MS);
  }

  /* 4. Show the masked text right away; start decoding once it is on screen. */
  maskAll();
  root.classList.add("is-ready");
  setStatus("block 0/" + blocks.length);
  if (controls) controls.hidden = false;
  if (replayBtn) replayBtn.addEventListener("click", run);

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        observer.disconnect();
        run();
      }
    }, { threshold: 0.25 });
    observer.observe(root);
  } else {
    run();
  }
})();
