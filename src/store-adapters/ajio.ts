/**
 * AJIO product adapter for Mr India.
 * Version 2: mobile price, title, image and selected variants.
 * Navigation and purchase blocking remain in browser.tsx.
 */
export const AJIO_ADAPTER_JS = String.raw`
(function () {
  if (!/(^|\.)ajio\.com$/i.test(location.hostname)) return;
  if (window.__miAjioAdapter &&
      window.__miAjioAdapter.version === 2) return;

  function clean(v) {
    return String(v == null ? "" : v)
      .replace(/\s+/g, " ").trim();
  }

  function text(selector) {
    var el = document.querySelector(selector);
    return clean(el && (el.innerText || el.textContent));
  }

  function meta(name) {
    var el = document.querySelector(
      'meta[property="' + name + '"],meta[name="' + name + '"]'
    );
    return clean(el && el.getAttribute("content"));
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    var s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 &&
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      Number(s.opacity) !== 0;
  }

  function isProductPage() {
    return /\/p\//i.test(location.pathname) ||
      !!document.querySelector(
        ".prod-name, .prod-sp, .prod-price, .product-title"
      );
  }

  function getTitle() {
    var brand = text(".brand-name") ||
      text(".prod-brand") ||
      text("[class*='brand-name']");

    var name = text(".prod-name") ||
      text("[class*='prod-name']") ||
      text(".product-title") ||
      text("[class*='product-title']") ||
      text("h1");

    if (name) {
      return clean(
        brand &&
        name.toLowerCase().indexOf(brand.toLowerCase()) !== 0
          ? brand + " " + name
          : name
      ).slice(0, 240);
    }

    var fallback = meta("og:title") ||
      meta("twitter:title") ||
      clean(document.title);

    return fallback
      .replace(/^Buy\s+/i, "")
      .replace(/\s+Online\s*\|.*$/i, "")
      .replace(/\s*\|\s*Ajio\.com.*$/i, "")
      .replace(/\s*\|\s*AJIO.*$/i, "")
      .slice(0, 240) || "AJIO product";
  }

  function amount(raw) {
    var m = clean(raw).match(
      /(?:\u20B9|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i
    );

    return m
      ? Number(m[1].replace(/,/g, "")) || 0
      : 0;
  }

  function badPriceText(value) {
    return /coupon|cashback|bank offer|emi|mobiKwik|new user offer|get it for|get at|buy at|extra off|free shipping/i
      .test(value);
  }

  // AJIO_V6_PRICE_AND_IMAGE
  function getPriceDetails() {
    if (!isProductPage()) {
      return { price: 0, source: "not-product" };
    }

    var raw = String(
      document.body ? document.body.innerText || "" : ""
    ).replace(/\s+/g, " ").trim();

    function valid(n) {
      return isFinite(n) && n > 0 && n < 10000000;
    }

    function parse(n) {
      return Number(String(n).replace(/,/g, ""));
    }

    // Selling price shown before the original MRP.
    var pair = raw.match(
      /Current\s*(?:Offer\s*)?Price\s*:\s*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*Actual\s*Price\s*:\s*MRP\s*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i
    );

    if (pair) {
      var selling = parse(pair[1]);
      var mrp = parse(pair[2]);

      if (valid(selling) && valid(mrp) && selling <= mrp) {
        return { price: selling, source: "v6-current-offer-with-mrp" };
      }
    }

    // Products with no separate MRP.
    // Use the actual price label, never coupon prices.
    var current = raw.match(
      /Current\s*(?:Offer\s*)?Price\s*:\s*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i
    );

    if (current) {
      var labeled = parse(current[1]);

      if (valid(labeled)) {
        return { price: labeled, source: "v6-current-price-label" };
      }
    }

    // AJIO sometimes displays just ₹11,300 before the tax label.
    var taxIndex = raw.search(/Price inclusive of all taxes/i);

    if (taxIndex >= 0) {
      var beforeTax = raw.slice(
        Math.max(0, taxIndex - 180),
        taxIndex
      );

      // Reject crossed-out MRP and promotional descriptions.
      if (!/MRP|Actual Price|Coupon|Cashback|EMI|Get it for/i.test(beforeTax)) {
        var amounts = [];
        var regex = /₹\s*([\d,]+(?:\.\d{1,2})?)/g;
        var match;

        while ((match = regex.exec(beforeTax)) !== null) {
          amounts.push({
            price: parse(match[1]),
            end: regex.lastIndex
          });
        }

        if (amounts.length) {
          var last = amounts[amounts.length - 1];
          var trailing = beforeTax.slice(last.end).trim();

          if (valid(last.price) && trailing.length < 55) {
            return { price: last.price, source: "v6-price-before-tax" };
          }
        }
      }
    }

    // Only accept explicit, dedicated selling-price DOM elements.
    var selectors = [
      ".prod-sp",
      "[class*='prod-sp']",
      "[class*='selling-price']",
      "[class*='sellingPrice']",
      "[class*='SellingPrice']",
      "[class*='current-price']",
      "[class*='currentPrice']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        if (!visible(nodes[j])) continue;

        var value = clean(nodes[j].innerText || nodes[j].textContent);

        if (!value || value.length > 70 ||
            /MRP|coupon|cashback|EMI|get it for/i.test(value)) {
          continue;
        }

        var parsed = amount(value);

        if (valid(parsed)) {
          return { price: parsed, source: "v6-dom-" + selectors[i] };
        }
      }
    }

    return { price: 0, source: "unverified" };
  }

  function getImage() {
    var path = String(location.pathname || "").toLowerCase();
    var productMatch = path.match(/\/p\/(\d+)_([a-z0-9-]+)/i);
    var productId = productMatch ? productMatch[1] : "";
    var productColor = productMatch ? productMatch[2] : "";

    function normalize(src) {
      src = clean(src);
      if (src.indexOf("//") === 0) src = location.protocol + src;

      if (!/^https?:\/\//i.test(src)) return "";
      if (/banner|logo|icon|sprite|placeholder|sticky/i.test(src)) return "";

      return src;
    }

    var images = document.querySelectorAll("img");
    var best = "";
    var bestScore = -1;

    for (var i = 0; i < images.length; i++) {
      var img = images[i];

      var src = normalize(
        img.currentSrc ||
        img.getAttribute("data-src") ||
        img.getAttribute("src") ||
        ""
      );

      if (!src) continue;

      var score = 0;
      var lower = src.toLowerCase();

      if (/assets\.ajio\.com\/medias\//.test(lower)) score += 100;
      if (productId && lower.indexOf(productId) >= 0) score += 300;
      if (productColor && lower.indexOf(productColor) >= 0) score += 120;
      if (/model|front|product/i.test(lower)) score += 30;

      if (visible(img)) {
        var r = img.getBoundingClientRect();
        if (r.width >= 100 && r.height >= 100) score += 40;
      }

      if (score > bestScore && score >= 100) {
        bestScore = score;
        best = src;
      }
    }

    if (best) return best;

    var og = normalize(meta("og:image"));
    if (og && (!productId || og.indexOf(productId) >= 0)) {
      return og;
    }

    // Do not substitute an unrelated promotional banner.
    return "";
  }
  // AJIO_V8_VARIANT_SELECTION
  // AJIO_OS_SIZE_FIX_V1 - Recognize selected OS / One Size tiles.
  function sizeValue(v) {
    v = clean(v);
    if (!v || v.length > 45) return "";

    var upper = v.toUpperCase();

    // Clothing sizes, including extended plus sizes.
    if (/^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|[2-9]XL|10XL|OS|ONE SIZE|FREE|FREE SIZE)$/i.test(upper)) {
      return upper;
    }

    // Numeric footwear and garment sizes.
    if (/^\d{1,3}(?:\.\d+)?$/.test(v)) {
      var n = Number(v);
      return n >= 1 && n <= 100 ? v : "";
    }

    // Children's age ranges, including wrapped labels.
    if (/^\d{1,2}\s*-\s*\d{1,2}\s*(?:Y|YR|YRS|YEARS)$/i.test(v)) {
      return upper.replace(/\s+/g, "");
    }

    // Single age labels such as 8Y, 10Y.
    if (/^\d{1,2}\s*(?:Y|YR|YRS|YEARS)$/i.test(v)) {
      return upper.replace(/\s+/g, "");
    }

    // Bed sizes.
    if (/^(?:KING|QUEEN|SINGLE|DOUBLE|SUPER KING|CAL KING|TWIN|FULL)$/i.test(v)) {
      return upper;
    }

    // Volume, weight, and pack measurements.
    if (/^\d+(?:\.\d+)?\s*(?:ML|L|GM|G|KG|MG|OZ|FL OZ|LB|LBS)$/i.test(v)) {
      return v.replace(/\s+/g, " ").trim();
    }

    // Pack counts such as Pack of 2, 6 PCS, SET OF 3.
    if (/^(?:PACK OF|SET OF)\s*\d{1,3}$/i.test(v) ||
        /^\d{1,3}\s*(?:PCS|PIECES|PAIR|PAIRS)$/i.test(v)) {
      return v;
    }

    return "";
  }

  // AJIO_V11_SELECTED_SIZE_ONLY
  // Transparent black backgrounds must NOT count as selected.
  function isDarkBackground(el) {
    try {
      var css = getComputedStyle(el);
      var bg = css.backgroundColor || "";
      var m = bg.match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/
      );
      if (!m) return false;

      var alpha = m[4] == null ? 1 : Number(m[4]);
      if (alpha < 0.85) return false;

      var brightness =
        (Number(m[1]) * 299 +
         Number(m[2]) * 587 +
         Number(m[3]) * 114) / 1000;

      return brightness < 105;
    } catch (e) {
      return false;
    }
  }

  function ajioSelectedState(el) {
    if (!el) return false;

    if (
      el.getAttribute("aria-selected") === "true" ||
      el.getAttribute("aria-checked") === "true" ||
      el.getAttribute("data-selected") === "true" ||
      el.getAttribute("data-active") === "true"
    ) return true;

    var cls = clean(el.getAttribute("class")).toLowerCase();

    if (/(^|[\s_-])(selected|checked|is-active|is-selected)([\s_-]|$)/.test(cls)) {
      return true;
    }

    return isDarkBackground(el);
  }

  function ajioUnavailableTile(el) {
    if (!el) return true;

    for (var i = 0, node = el; node && i < 2; i++, node = node.parentElement) {
      if (
        node.getAttribute("aria-disabled") === "true" ||
        node.getAttribute("data-disabled") === "true" ||
        node.hasAttribute("disabled")
      ) return true;

      var cls = clean(node.getAttribute("class")).toLowerCase();

      if (/(^|[\s_-])(disabled|soldout|sold-out|unavailable|out-of-stock)([\s_-]|$)/.test(cls)) {
        return true;
      }
    }

    return false;
  }

  function ajioFindSizeHeading() {
    var nodes = document.querySelectorAll(
      "h1, h2, h3, h4, div, span, label"
    );

    var best = null;

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visible(el)) continue;

      var value = clean(el.innerText || el.textContent);

      if (!/^(Select Size|Choose Size)$/i.test(value)) continue;

      // Prefer the smallest visible heading element.
      if (!best || best.contains(el)) best = el;
    }

    return best;
  }

  function ajioSizeTile(el, size) {
    // A size label may be nested in a span. Find its own
    // compact button/tile, not a container for the whole row.
    var node = el;

    for (var depth = 0; node && depth < 4; depth++) {
      var r = node.getBoundingClientRect();
      var value = clean(node.innerText || node.textContent);

      if (
        r.width > 15 && r.width <= 155 &&
        r.height > 15 && r.height <= 115 &&
        sizeValue(value) === size
      ) {
        if (
          node.matches("button, [role='button'], [role='radio'], li, label") ||
          ajioSelectedState(node)
        ) {
          return node;
        }
      }

      node = node.parentElement;
    }

    return null;
  }

  function getSelectedSize() {
    var heading = ajioFindSizeHeading();
    if (!heading) return "";

    var nodes = document.querySelectorAll(
      "button, [role='button'], [role='radio'], li, label, span, div"
    );

    var headingRect = heading.getBoundingClientRect();
    var best = "";
    var bestScore = -1;
    var found = {};

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];

      if (!visible(el) || el === heading) continue;

      if (!(heading.compareDocumentPosition(el) & 4)) {
        continue;
      }

      var raw = clean(el.innerText || el.textContent);
      var size = sizeValue(raw);

      // Never accept an unrecognised string as a size.
      if (!size) continue;

      var tile = ajioSizeTile(el, size);
      if (!tile || !visible(tile)) continue;

      var r = tile.getBoundingClientRect();
      var distance = r.top - headingRect.bottom;

      if (distance < -15 || distance > 340) continue;
      if (ajioUnavailableTile(tile)) continue;

      var selected =
        ajioSelectedState(tile) ||
        ajioSelectedState(el);

      // Crucial: a normal, white, unselected size is NEVER
      // accepted merely because it is visible.
      if (!selected) continue;

      var key = size + "|" + Math.round(r.left) + "|" + Math.round(r.top);
      if (found[key]) continue;
      found[key] = true;

      var score = 200;

      if (isDarkBackground(tile)) score += 100;
      if (isDarkBackground(el)) score += 25;

      score -= Math.min(40, Math.max(0, distance) / 10);

      if (score > bestScore) {
        best = size;
        bestScore = score;
      }
    }

    // No positive selection evidence means no selected size.
    return best;
  }
  function getSelectedColor() {
    // AJIO_V3_COLOR
    var productPath = String(location.pathname || "");

    var colourMatch = productPath.match(
      /\/p\/[^/]*?_([a-z][a-z0-9-]*)$/i
    );

    if (colourMatch) {
      var colour = colourMatch[1].replace(/-/g, " ");

      if (
        colour.length <= 45 &&
        !/^(default|product|undefined|null|na)$/i.test(colour)
      ) {
        return colour.replace(/\b[a-z]/g, function(ch) {
          return ch.toUpperCase();
        });
      }
    }

    var selectors = [
      "[aria-selected='true'][class*='color']",
      "[aria-selected='true'][class*='colour']",
      "[aria-checked='true'][class*='color']",
      "[aria-checked='true'][class*='colour']",
      "[data-selected='true'][class*='color']",
      "[data-selected='true'][class*='colour']",
      "[class*='color'][class*='selected']",
      "[class*='colour'][class*='selected']",
      "[class*='Color'][class*='selected']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (!visible(el)) continue;

        var value = clean(
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.getAttribute("data-color") ||
          el.getAttribute("data-colour") ||
          el.innerText ||
          el.textContent
        ).replace(/^(?:selected\s+)?colou?r\s*:\s*/i, "");

        if (value && value.length <= 45 &&
            !/\u20B9|size chart|select size/i.test(value) &&
            !sizeValue(value)) {
          return value;
        }
      }
    }

    var body = clean(
      document.body ? document.body.innerText : ""
    );

    var m = body.match(
      /Selected\s+(?:Color|Colour)\s*:\s*([A-Za-z][A-Za-z /-]{1,35}?)(?=\s+(?:Size|MRP|Delivery|Product Details)|$)/i
    );

    return m ? clean(m[1]) : "";
  }

  // AJIO_V9_STOCK_GUARD
  function getStockStatus(selectedSize) {
    if (!isProductPage()) {
      return {
        blocked: true,
        reason: "not-product",
        message: "Please open an AJIO product page before continuing."
      };
    }

    var pageText = String(
      document.body ? document.body.innerText || "" : ""
    );

    // Read the main product content, not unrelated recommendations.
    var end = pageText.search(
      /(?:You May Also Like|Similar Products|Recently Viewed)/i
    );

    var productText = end >= 0
      ? pageText.slice(0, end)
      : pageText.slice(0, 12000);

    // Check short visible status elements, not arbitrary coupon text.
    var elements = document.querySelectorAll(
      "button, [role='button'], [role='status'], " +
      "[class*='stock'], [class*='Stock'], " +
      "[class*='availability'], [class*='Availability'], " +
      "[class*='sold'], [class*='Sold']"
    );

    var explicitSoldOut = false;
    var evidence = "";

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];

      if (!visible(el)) continue;

      var value = clean(el.innerText || el.textContent);

      if (
        value.length > 0 &&
        value.length <= 100 &&
        /^(?:Sold Out|Out of Stock|Currently Unavailable|Product Unavailable|Temporarily Unavailable|Notify Me|Notify When Available)$/i.test(value)
      ) {
        explicitSoldOut = true;
        evidence = value;
        break;
      }
    }

    // Some AJIO sold-out notices are plain text.
    if (!explicitSoldOut) {
      var lines = productText.split(/\r?\n/);

      for (var j = 0; j < lines.length; j++) {
        var line = clean(lines[j]);

        if (
          /^(?:Sold Out|Out of Stock|Currently Unavailable|Product Unavailable|Temporarily Unavailable)$/i.test(line)
        ) {
          explicitSoldOut = true;
          evidence = line;
          break;
        }
      }
    }

    if (explicitSoldOut) {
      return {
        blocked: true,
        reason: "out-of-stock",
        message: "This AJIO product is currently out of stock.",
        evidence: evidence
      };
    }

    // AJIO_V11_UNAVAILABLE_SIZE_GUARD
    // AJIO may retain an older selected size after a tap on
    // an unavailable size that opens a similar-product tip.
    var lastTap = window.__miAjioLastSizeTap;
    var unavailableTip = clean(
      document.body ? document.body.innerText || "" : ""
    ).match(
      /Click to view similar product available in size\s+([A-Za-z0-9 .-]{1,20})/i
    );

    if (
      lastTap &&
      lastTap.path === String(location.pathname || "") &&
      Date.now() - lastTap.time < 30000 &&
      unavailableTip &&
      clean(unavailableTip[1]).toUpperCase() ===
        clean(lastTap.size).toUpperCase() &&
      clean(selectedSize).toUpperCase() !==
        clean(lastTap.size).toUpperCase()
    ) {
      return {
        blocked: true,
        reason: "size-unavailable",
        message:
          "Size " + lastTap.size +
          " is unavailable on AJIO. Please choose another available size.",
        evidence: clean(unavailableTip[0])
      };
    }
    // A displayed size selector requires a real selected size.
    var headings = document.querySelectorAll(
      "h1, h2, h3, h4, span, div, label"
    );

    var hasSizeSelector = false;

    for (var k = 0; k < headings.length; k++) {
      var heading = headings[k];

      if (!visible(heading)) continue;

      var headingText = clean(
        heading.innerText || heading.textContent
      );

      if (/^(?:Select Size|Choose Size)$/i.test(headingText)) {
        hasSizeSelector = true;
        break;
      }
    }

    // AJIO can show a similar-product suggestion when the
    // requested size is unavailable on the current product.
    // Do not classify the entire product as sold out.
    if (hasSizeSelector && !selectedSize) {
      var similarSizeText = clean(
        document.body ? document.body.innerText || "" : ""
      );

      var unavailableSize = similarSizeText.match(
        /Click to view similar product available in size\s+([A-Za-z0-9 .-]{1,20})/i
      );

      if (unavailableSize) {
        return {
          blocked: true,
          reason: "size-unavailable",
          message: "This size is not available for the selected AJIO product. Please choose another available size.",
          evidence: clean(unavailableSize[0])
        };
      }
    }

    if (hasSizeSelector && !selectedSize) {
      return {
        blocked: true,
        reason: "size-required",
        message: "Please select an available size on AJIO before adding this product."
      };
    }

    // A delivery prompt alone does not confirm sold-out status.
    return {
      blocked: false,
      reason: "not-verified",
      message: "",
      availabilityVerified: false
    };
  }
  function getVariants() {
    var result = [];
    var size = getSelectedSize();
    var color = getSelectedColor();

    if (color) {
      result.push({ name: "Color", value: color });
    }

    if (size) {
      result.push({ name: "Size", value: size });
    }

    return result;
  }

  function scrape() {
    var price = getPriceDetails();
    var variants = getVariants();
    var size = "";
    var color = "";

    for (var i = 0; i < variants.length; i++) {
      if (variants[i].name === "Size") {
        size = variants[i].value;
      }
      if (variants[i].name === "Color") {
        color = variants[i].value;
      }
    }

    return {
      adapter: "ajio",
      store: "AJIO",
      isProductPage: isProductPage(),
      name: getTitle(),
      inr: price.price,
      image: getImage(),
      link: String(location.href || "").split("#")[0],
      variants: variants,
      options: variants.map(function(v) {
        return v.name + ": " + v.value;
      }).join(" | "),
      size: size,
      color: color,
      stockStatus: getStockStatus(size),
      __ajioDebug: {
        version: 2,
        priceSource: price.source,
        priceProbe: (function() {
          var raw = String(document.body ? document.body.innerText || "" : "");
          var mrpIndex = raw.search(/MRP/i);
          var priceNodes = [];

          var nodes = document.querySelectorAll(
            ".prod-sp, .prod-price, [class*='price'], [class*='Price'], strong, span"
          );

          for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var value = String(el.innerText || el.textContent || "").trim();

            if (!value || value.length > 100) continue;
            if (!/₹|MRP|Rs\.?|INR/i.test(value)) continue;

            priceNodes.push({
              text: value,
              className: String(el.className || "").slice(0, 100)
            });

            if (priceNodes.length >= 15) break;
          }

          return {
            mrpFound: mrpIndex >= 0,
            aroundMrp: mrpIndex >= 0
              ? raw.slice(Math.max(0, mrpIndex - 120), mrpIndex + 180)
              : "",
            rupeeFound: raw.indexOf("\u20B9") >= 0,
            priceNodes: priceNodes
          };
        })(),
        extractedPrice: price.price, stock: getStockStatus(size),
        title: getTitle(),
        image: getImage(),
        size: size,
        color: color,
        variants: variants,
        url: String(location.pathname || "")
      }
    };
  }

  // AJIO_V11_SIZE_TAP_TRACKING
  // Only record taps near the actual Select Size controls.
  if (!window.__miAjioSizeTrackingInstalled) {
    window.__miAjioSizeTrackingInstalled = true;

    document.addEventListener("click", function(event) {
      try {
        var heading = ajioFindSizeHeading();
        if (!heading) return;

        var hr = heading.getBoundingClientRect();
        var node = event.target;

        for (var depth = 0; node && depth < 5; depth++) {
          if (!node.getBoundingClientRect) break;

          var r = node.getBoundingClientRect();
          var size = sizeValue(node.innerText || node.textContent);

          if (
            size &&
            r.width >= 15 && r.width <= 155 &&
            r.height >= 15 && r.height <= 115 &&
            r.top >= hr.bottom - 15 &&
            r.top <= hr.bottom + 340
          ) {
            window.__miAjioLastSizeTap = {
              size: size,
              time: Date.now(),
              path: String(location.pathname || "")
            };
            return;
          }

          node = node.parentElement;
        }
      } catch (e) {}
    }, true);
  }
  window.__miAjioAdapter = {
    version: 2,
    isProductPage: isProductPage,
    getTitle: getTitle,
    getPrice: function() {
      return getPriceDetails().price;
    },
    getImage: getImage,
    getVariants: getVariants,
    scrape: scrape
  };
})();
`;