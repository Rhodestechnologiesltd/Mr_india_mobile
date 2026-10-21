/**
 * IKEA_ADAPTER_V1
 *
 * Dedicated IKEA product extraction.
 * Prefer the currently displayed selling price.
 * Preserve legacy name, image and variants.
 * No website mutation.
 */

export const IKEA_ADAPTER_JS = String.raw`
(function () {
  if (!/(^|\.)ikea\.com$/i.test(location.hostname)) return;

  if (window.__miIkeaAdapter &&
      window.__miIkeaAdapter.version === 4) return;

  function clean(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ").trim();
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;

    var r = el.getBoundingClientRect();
    var s = window.getComputedStyle(el);

    return r.width > 0 &&
      r.height > 0 &&
      s.display !== "none" &&
      s.visibility !== "hidden";
  }

  function number(value) {
    var n = Number(
      String(value || "").replace(/,/g, "")
    );

    return isFinite(n) && n > 0 ? n : 0;
  }

  function currencyPrice(value) {
    var text = clean(value);

    var m = text.match(
      /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i
    );

    return m ? number(m[1]) : 0;
  }

  function isRegularPrice(el) {
    if (!el) return false;

    var s = window.getComputedStyle(el);

    if (
      String(s.textDecorationLine || "")
        .indexOf("line-through") >= 0
    ) {
      return true;
    }

    var label = clean(
      el.getAttribute("aria-label") || ""
    ).toLowerCase();

    if (
      /regular price|original price|mrp|previous price/.test(label)
    ) {
      return true;
    }

    return false;
  }

  /*
   * IKEA_PRICE_V2_1
   * Read live product selling price only.
   * Do not use regular price, offers or unrelated cards.
   */
  function currentPrice() {
    var examined = [];

    function result(value, source) {
      return {
        value: value,
        source: source,
        examined: examined
      };
    }

    function oldPrice(el) {
      var node = el;

      for (var n = 0; node && n < 3; n++) {
        var cls = clean(
          node.getAttribute("class") || ""
        ).toLowerCase();

        var label = clean(
          node.getAttribute("aria-label") || ""
        ).toLowerCase();

        if (
          /regular|previous|original|strike|crossed|old-price|mrp/.test(
            cls + " " + label
          )
        ) return true;

        var style = window.getComputedStyle(node);

        if (
          String(style.textDecorationLine || "")
            .indexOf("line-through") >= 0
        ) return true;

        node = node.parentElement;
      }

      return false;
    }

    function priceNumber(text, bare) {
      text = clean(text);

      var match = text.match(
        /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i
      );

      if (match) return number(match[1]);

      if (
        bare &&
        /^[\d,]+(?:\.\d{1,2})?$/.test(text)
      ) {
        return number(text);
      }

      return 0;
    }

    /*
     * IKEA often renders the currency and numeric
     * amount in separate child elements.
     */
    var selectors = [
      "[class*='pip-price'] [class*='integer']",
      "[class*='pip-temp-price'] [class*='integer']",
      "[data-testid='product-price'] [class*='integer']",
      ".pip-price__integer",
      ".pip-temp-price__integer",
      "[class*='pip-price__integer']",
      "[class*='pip-temp-price__integer']",
      "[data-testid='product-price']",
      ".pip-price",
      ".pip-temp-price"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length && j < 30; j++) {
        var el = nodes[j];

        if (!visible(el) || oldPrice(el)) continue;

        var raw = clean(
          el.innerText || el.textContent || ""
        );

        if (!raw || raw.length > 130) continue;

        var integerSelector =
          /integer/i.test(selectors[i]);

        var value = priceNumber(raw, integerSelector);

        examined.push({
          selector: selectors[i],
          text: raw.slice(0, 90),
          price: value
        });

        if (value > 0) {
          return result(value, selectors[i]);
        }
      }
    }

    /*
     * Different IKEA layouts can expose the live
     * price through visible text instead.
     *
     * Search only after the current product title.
     * Stop at Regular price / offers / delivery.
     */
    var body = document.body
      ? String(document.body.innerText || "")
      : "";

    var lines = body.split(/\r?\n/)
      .map(clean)
      .filter(Boolean);

    var titleEl = document.querySelector(
      "[data-testid='product-name'], " +
      ".pip-header-section__title--big, h1"
    );

    var title = clean(
      titleEl &&
      (titleEl.innerText || titleEl.textContent)
    );

    var titleIndex = -1;

    if (title.length >= 3) {
      for (var k = 0; k < lines.length; k++) {
        if (
          lines[k].toLowerCase() === title.toLowerCase()
        ) {
          titleIndex = k;
          break;
        }
      }
    }

    if (titleIndex >= 0) {
      var limit = Math.min(lines.length, titleIndex + 18);

      for (var m = titleIndex + 1; m < limit; m++) {
        var line = lines[m];

        if (
          /regular price|original price|previous price|price incl|how to get it|check delivery/i.test(line)
        ) break;

        if (
          /cashback|coupon|bank offer|hdfc|emi|save rs|% off/i.test(line)
        ) continue;

        var extracted = priceNumber(line, false);

        /*
         * Handle:
         *   Rs.
         *   349
         */
        if (
          !extracted &&
          /^(?:Rs\.?|INR|₹)$/i.test(line) &&
          m + 1 < limit
        ) {
          extracted = priceNumber(lines[m + 1], true);
        }

        examined.push({
          selector: "product-title-nearby",
          text: line.slice(0, 90),
          price: extracted
        });

        if (extracted > 0) {
          return result(
            extracted,
            "product-title-nearby"
          );
        }
      }
    }

    return result(0, "selling-price-not-found");
  }
  /*
   * IKEA_STOCK_V4
   *
   * Detect explicit product-level stock failures.
   * Do not assume missing postal code means out of stock.
   * Do not treat unavailable delivery alone as sold out.
   * No website mutation.
   */
  function stockAvailability() {
    var evidence = [];
    var unavailable = false;

    function record(source, text, block) {
      if (evidence.length < 12) {
        evidence.push({
          source: source,
          text: clean(text).slice(0, 180),
          blocked: !!block
        });
      }

      if (block) unavailable = true;
    }

    /*
     * Only inspect IKEA product pages.
     * Never inspect search results or unrelated cards.
     */
    if (!/\/in\/en\/p\/[^/]+\/?/i.test(location.pathname)) {
      return {
        blocked: false,
        reason: "not-product",
        availabilityVerified: false,
        message: "",
        evidence: evidence
      };
    }

    /*
     * First check visible messages within the
     * main product purchase/availability sections.
     */
    var selectors = [
      "[data-testid*='availability']",
      "[data-testid*='stock']",
      "[class*='pip-availability']",
      "[class*='pip-delivery']",
      "[class*='pip-buy-module']",
      "[class*='pip-add-to-cart']"
    ];

    var explicitOut = /(?:out of stock|sold out|currently unavailable|temporarily out of stock|not in stock|no longer available|not available for purchase|unavailable to purchase)/i;

    var deliveryOnly = /(?:delivery is unavailable|delivery unavailable|not available for delivery|delivery not available|not deliverable|cannot deliver|not available in your area|not available at your location)/i;

    var neutral = /(?:check delivery|check availability|check delivery and in-stock availability|enter postal code|select store|notify me when available)/i;

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length && j < 20; j++) {
        var el = nodes[j];

        if (!visible(el)) continue;

        var txt = clean(el.innerText || el.textContent || "");

        if (!txt || txt.length > 300) continue;

        if (explicitOut.test(txt)) {
          record(selectors[i], txt, true);
        } else if (deliveryOnly.test(txt)) {
          record(selectors[i], txt, false);
        } else if (neutral.test(txt)) {
          record(selectors[i], txt, false);
        }
      }
    }

    /*
     * Inspect the main product actions.
     * Explicit "Out of stock" or "Sold out"
     * purchase buttons are strong evidence.
     */
    var actions = document.querySelectorAll(
      "button,[role='button']"
    );

    for (var a = 0; a < actions.length && a < 120; a++) {
      var btn = actions[a];

      if (!visible(btn)) continue;

      var label = clean(
        btn.getAttribute("aria-label") ||
        btn.innerText ||
        btn.textContent ||
        ""
      );

      if (
        /^(?:out of stock|sold out|currently unavailable|not available)$/i.test(label)
      ) {
        record("purchase-action", label, true);
      }
    }

    /*
     * IKEA's "How to get it" section sometimes
     * displays availability as plain text.
     * Inspect only this limited section.
     */
    var body = document.body
      ? String(document.body.innerText || "")
      : "";

    var start = body.toLowerCase().indexOf("how to get it");

    if (start >= 0) {
      var section = body.slice(start, start + 500);

      var stop = section.search(
        /(?:collect ikea family points|returns and claims|product details|product measurements|reviews and ratings)/i
      );

      if (stop >= 0) {
        section = section.slice(0, stop);
      }

      var lines = section.split(/\r?\n/);

      for (var k = 0; k < lines.length && k < 24; k++) {
        var line = clean(lines[k]);

        if (!line) continue;

        if (
          explicitOut.test(line) &&
          !deliveryOnly.test(line)
        ) {
          record("how-to-get-it", line, true);
        }
      }
    }

    return {
      blocked: unavailable,
      reason: unavailable
        ? "explicit-out-of-stock"
        : "stock-not-verified",
      availabilityVerified: unavailable,
      message: unavailable
        ? "IKEA indicates that this product is currently unavailable. Please select an available product or variant."
        : "",
      evidence: evidence
    };
  }
  function scrape() {
    var legacy = {};

    try {
      if (typeof window.__miScrape === "function") {
        legacy = window.__miScrape() || {};
      }
    } catch (e) {
      legacy = {};
    }

    var stock = stockAvailability();
    var live = currentPrice();
    var legacyPrice = number(legacy.inr);

    var price = live.value > 0
      ? live.value
      : 0;

    var result = {};

    for (var key in legacy) {
      if (Object.prototype.hasOwnProperty.call(legacy, key)) {
        result[key] = legacy[key];
      }
    }

    result.stockStatus = {
      blocked: stock.blocked,
      reason: stock.reason,
      availabilityVerified: stock.availabilityVerified,
      message: stock.message
    };
    result.adapter = "ikea";
    result.store = "IKEA";
    result.inr = price;
    result.link = String(location.href || "").split("#")[0];

    result.__ikeaDebug = {
      stockStatus: stock,
      version: 2,
      url: location.pathname,
      legacyPrice: legacyPrice,
      sellingPrice: price,
      priceSource: live.source,
      examinedPriceNodes: live.examined,
      name: result.name || "",
      image: result.image || "",
      size: result.size || "",
      color: result.color || "",
      options: result.options || ""
    };

    return result;
  }

  window.__miIkeaAdapter = {
    version: 4,
    scrape: scrape
  };
})();
`;
