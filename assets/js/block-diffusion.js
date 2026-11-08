/*
 * Block-diffusion text decoding, one paragraph per block.
 *
 * The text inside [data-diffuse] is split into word tokens, and every token
 * starts masked. Paragraphs are decoded one after the other, from the first to
 * the last. Inside a paragraph, tokens are unmasked in a random order (not left
 * to right) over several denoising steps, following a cosine schedule: few
 * tokens are revealed at first, then more and more, as in masked diffusion
 * language models.
 *
 * Without JavaScript, or with reduced motion requested, the text is shown as is.
 */
(function () {
  "use strict";

  var TOKENS_PER_STEP = 4;  // sets the number of steps: ~ paragraph length / 4
  var MIN_STEPS = 4;        // denoising steps for the shortest paragraphs
  var MAX_STEPS = 12;       // denoising steps for the longest paragraphs
  var STEP_MS = 50;        // delay between denoising steps
  var BLOCK_GAP_MS = 350;   // pause between paragraphs
  var FRESH_MS = 900;       // how long a newly decoded token stays highlighted

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

  /* One block per paragraph (each top-level element of the container). */
  var blocks = [];
  var lastParent = null;
  tokens.forEach(function (tok) {
    var parent = tok;
    while (parent.parentNode !== root) parent = parent.parentNode;
    if (parent !== lastParent) {
      blocks.push([]);
      lastParent = parent;
    }
    blocks[blocks.length - 1].push(tok);
  });

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

  function stepsFor(block) {
    var n = Math.ceil(block.length / TOKENS_PER_STEP);
    return Math.max(MIN_STEPS, Math.min(MAX_STEPS, n));
  }

  /* Cosine masking schedule: number of tokens still masked after step s of S. */
  function maskedAfter(s, S, n) {
    return Math.floor(n * Math.cos((Math.PI / 2) * (s / S)));
  }

  /* 3. Decode paragraph by paragraph; random unmasking order inside each. */
  function run() {
    clearTimers();
    maskAll();

    var t = 250;
    blocks.forEach(function (block, b) {
      var steps = stepsFor(block);
      var label = "paragraph " + (b + 1) + "/" + blocks.length;

      later(function () {
        block.forEach(function (tok) { tok.classList.add("is-active"); });
        setStatus(label + " · step 0/" + steps);
      }, t);

      var order = shuffle(block.slice());
      var n = order.length;
      for (var s = 1; s <= steps; s++) {
        var chunk = order.slice(n - maskedAfter(s - 1, steps, n), n - maskedAfter(s, steps, n));
        t += STEP_MS;
        later((function (chunk, s) {
          return function () {
            chunk.forEach(reveal);
            updateLinks();
            setStatus(label + " · step " + s + "/" + steps);
          };
        })(chunk, s), t);
      }
      t += BLOCK_GAP_MS;
    });

    later(function () {
      root.classList.remove("is-diffusing");
      setStatus(tokens.length + " tokens · " + blocks.length + " paragraphs");
    }, t + FRESH_MS);
  }

  /* 4. Show the masked text right away; start decoding once it is on screen. */
  maskAll();
  root.classList.add("is-ready");
  setStatus("paragraph 0/" + blocks.length);
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
