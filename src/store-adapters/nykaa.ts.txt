/**
 * Nykaa India product adapter for the Mr India WebView.
 * NYKAA_V1
 * Product extraction only; navigation and purchase blocking
 * remain in browser.tsx.
 */
export const NYKAA_ADAPTER_JS = String.raw`
(function () {
  if (!/(^|\.)nykaa\.com$/i.test(location.hostname)) return;
  if (window.__miNykaaAdapter &&
      window.__miNykaaAdapter.version === 1) return;

  function clean(v) {
    return String(v == null ? "" : v)
      .replace(/\s+/g, " ").trim();
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

  function meta(key) {
    var el = document.querySelector(
      'meta[property="' + key + '"],meta[name="' + key + '"]'
    );
    return clean(el && el.getAttribute("content"));
  }

  function text(selector) {
    var el = document.querySelector(selector);
    return clean(el && (el.innerText || el.textContent));
  }

  function isProductPage() {
    return /\/p\/\d+/i.test(location.pathname) ||
      (/\/p\//i.test(location.pathname) &&
       !!document.querySelector("h1")) ||
      !!document.querySelector(
        "[data-testid='product-name'], .product-title"
      );
  }

  function getTitle() {
    var title =
      text("[data-testid='product-name']") ||
      text("h1") ||
      text("[class*='product-title']") ||
      text("[class*='ProductTitle']") ||
      meta("og:title") ||
      meta("twitter:title") ||
      clean(document.title);

    return title
      .replace(/\s*\|\s*Nykaa.*$/i, "")
      .replace(/\s*-\s*Buy Online.*$/i, "")
      .slice(0, 240) || "Nykaa product";
  }

  function parseMoney(v) {
    var m = clean(v).match(
      /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i
    );
    return m ? Number(m[1].replace(/,/g, "")) || 0 : 0;
  }

  function validPrice(v) {
    return isFinite(v) && v > 0 && v < 10000000;
  }

  // NYKAA_V2_CURRENT_SELLING_PRICE
  // NYKAA_V3_TITLE_ANCHORED_PRICE
  function getPriceDetails() {
    if (!isProductPage()) {
      return { price: 0, source: "not-product" };
    }

    function amounts(raw) {
      var matches = String(raw || "").match(
        /(?:₹|INR|Rs\.?)\s*[\d,]+(?:\.\d{1,2})?/gi
      ) || [];

      return matches.map(function(item) {
        var number = item.match(/[\d,]+(?:\.\d{1,2})?$/);
        return number
          ? Number(number[0].replace(/,/g, ""))
          : 0;
      }).filter(function(number) {
        return validPrice(number);
      });
    }

    var body = String(
      document.body ? document.body.innerText || "" : ""
    );

    var lines = body.split(/\r?\n/).map(clean).filter(Boolean);

    var title = clean(getTitle());
    var anchor = title.toLowerCase().slice(0, 35);
    var titleLine = -1;

    // Find the actual product title, not a promotion or
    // a size-card price appearing elsewhere on the page.
    if (anchor.length >= 8) {
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().indexOf(anchor) >= 0) {
          titleLine = i;
          break;
        }
      }
    }

    if (titleLine < 0) {
      return {
        price: 0,
        source: "v3-product-title-not-found"
      };
    }

    var regularPrices = [];
    var diwaliPrice = 0;
    var expectDiwaliPrice = false;

    // Read only the current product information directly
    // after its title, never the coupon/offers section.
    var end = Math.min(lines.length, titleLine + 26);

    for (var j = titleLine + 1; j < end; j++) {
      var line = lines[j];

      // These sections are NOT the product selling price.
      if (
        /^(?:Coupons?|Offers?|Authenticity|Check Delivery|Product Details|Ratings & Reviews|Frequently Bought|Similar Products|Recommended Products|You May Also Like)\b/i.test(line)
      ) {
        break;
      }

      // Avoid per-item costs and unrelated promotion amounts.
      if (
        /cashback|bank offer|coupon|EMI|reward points|shop for|extra \d+%|per ml|per g|per unit/i.test(line)
      ) {
        continue;
      }

      // NYKAA_V4_NORMAL_PRICE_ONLY
      // Promotional Diwali prices are excluded.
      // Only prices before this section belong to the normal price group.
      if (/Diwali\s+Sale\s+Price/i.test(line)) {
        break;
      }

      var prices = amounts(line);
      if (!prices.length) continue;

      // The product's normal price group is the first
      // one or two amounts after the product heading:
      //
      // ₹3999 ₹1600 60%   -> ₹1600
      // ₹100 ₹80 20%      -> ₹80
      // ₹1899             -> ₹1899
      //
      // Never collect amounts after reaching coupons.
      for (var p = 0; p < prices.length; p++) {
        if (regularPrices.length < 2) {
          regularPrices.push(prices[p]);
        }
      }

      if (regularPrices.length >= 2) {
        // We already have MRP and the selling price.
        // Continue only to look for a labelled Diwali sale.
        continue;
      }
    }

    var regular = 0;

    if (regularPrices.length >= 2) {
      regular = Math.min(
        regularPrices[0],
        regularPrices[1]
      );
    } else if (regularPrices.length === 1) {
      regular = regularPrices[0];
    }

    if (validPrice(regular)) {
      return {
        price: regular,
        source: regularPrices.length >= 2
          ? "v3-current-product-sale-pair"
          : "v3-current-product-single-price"
      };
    }

    return {
      price: 0,
      source: "v3-price-unverified"
    };
  }
  function getImage() {
    var selectors = [
      "[data-testid*='product-image'] img",
      "[class*='product-image'] img",
      "[class*='ProductImage'] img",
      "img[src*='nykaa']",
      "img[src*='nimg']"
    ];

    var best = "";
    var bestScore = -1;

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        var src = clean(
          el.currentSrc ||
          el.getAttribute("data-src") ||
          el.getAttribute("src")
        );

        if (src.indexOf("//") === 0) {
          src = location.protocol + src;
        }

        if (!/^https?:\/\//i.test(src) ||
            /logo|banner|icon|placeholder|sprite/i.test(src)) {
          continue;
        }

        var score = 0;
        if (i < 3) score += 100;

        if (visible(el)) {
          var r = el.getBoundingClientRect();
          if (r.width >= 120 && r.height >= 120) score += 90;
        }

        if (el.naturalWidth >= 200) score += 20;

        if (score > bestScore) {
          bestScore = score;
          best = src;
        }
      }
    }

    return best || meta("og:image") || "";
  }

  function selected(el) {
    if (!el) return false;

    if (
      el.getAttribute("aria-selected") === "true" ||
      el.getAttribute("aria-checked") === "true" ||
      el.getAttribute("data-selected") === "true" ||
      el.getAttribute("data-active") === "true"
    ) return true;

    var cls = clean(el.getAttribute("class")).toLowerCase();

    if (/(^|[\s_-])(selected|checked|is-selected|is-active)([\s_-]|$)/
        .test(cls)) return true;

    // Nykaa commonly highlights selected variants in pink.
    try {
      var style = getComputedStyle(el);
      var borders = [
        style.borderTopColor,
        style.borderRightColor,
        style.borderBottomColor,
        style.borderLeftColor
      ];
      var widths = [
        parseFloat(style.borderTopWidth) || 0,
        parseFloat(style.borderRightWidth) || 0,
        parseFloat(style.borderBottomWidth) || 0,
        parseFloat(style.borderLeftWidth) || 0
      ];

      for (var i = 0; i < borders.length; i++) {
        if (widths[i] < 1) continue;

        var color = borders[i].toLowerCase();

        if (/#e80071|#fc2779|#d50066|rgb\(232,\s*0,\s*113\)|rgb\(252,\s*39,\s*121\)/
            .test(color)) return true;
      }
    } catch (e) {}

    return false;
  }

  function disabled(el) {
    if (!el) return false;

    var cls = clean(el.getAttribute("class")).toLowerCase();

    return el.hasAttribute("disabled") ||
      el.getAttribute("aria-disabled") === "true" ||
      el.getAttribute("data-disabled") === "true" ||
      /(^|[\s_-])(disabled|sold-out|soldout|unavailable)([\s_-]|$)/
        .test(cls);
  }

  function sizeValue(raw) {
    var v = clean(raw);
    if (!v || v.length > 45) return "";

    // Remove a price appended to a compact variant card.
    v = clean(v.split(/₹|MRP|Price per/i)[0]);

    if (/^\d+(?:\.\d+)?\s*(?:ml|l|g|gm|kg|mg|oz|fl oz)$/i.test(v)) {
      return v;
    }

    if (/^(?:pack|set)\s+of\s+\d{1,3}$/i.test(v)) {
      return v;
    }

    if (/^\d{1,3}\s*(?:pcs|pieces|pairs?)$/i.test(v)) {
      return v;
    }

    if (/^(?:XXS|XS|S|M|L|XL|XXL|[2-9]XL|FREE SIZE|ONE SIZE|OS)$/i.test(v)) {
      return v.toUpperCase();
    }

    if (/^\d{1,3}(?:\.\d+)?$/.test(v)) {
      return v;
    }

    return "";
  }

  // NYKAA_V2_SELECTED_VARIANTS
  function getVariants() {
    var result = [];
    var seen = {};

    function add(name, value) {
      value = clean(value);

      if (!value || value.length > 80 ||
          /coupon|cashback|select shade|all shades|all sizes|add to bag/i.test(value)) {
        return;
      }

      var key = name.toLowerCase();

      if (seen[key]) return;
      seen[key] = true;

      result.push({ name: name, value: value });
    }

    function firstLine(el) {
      var raw = String(el.innerText || el.textContent || "");
      var lines = raw.split(/\r?\n/);

      for (var i = 0; i < lines.length; i++) {
        var value = clean(lines[i]);
        if (value) return value;
      }

      return "";
    }

    function selectedCard(el) {
      if (!el || !visible(el) || disabled(el)) return false;

      if (selected(el)) return true;

      var parent = el.parentElement;

      // A pink selection border may be on the immediate
      // card wrapper instead of its text element.
      if (parent && visible(parent) && !disabled(parent)) {
        var r = parent.getBoundingClientRect();

        if (r.width <= 185 && r.height <= 150 &&
            selected(parent)) {
          return true;
        }
      }

      return false;
    }

    // Find genuine size/volume cards near "Select Size".
    var nodes = document.querySelectorAll(
      "button, [role='button'], [role='radio'], " +
      "li, label, div, span"
    );

    var sizeHeading = null;
    var shadeHeading = null;

    for (var h = 0; h < nodes.length; h++) {
      var heading = nodes[h];
      if (!visible(heading)) continue;

      var headingText = clean(
        heading.innerText || heading.textContent
      );

      if (/^(Select Size|Choose Size)$/i.test(headingText)) {
        if (!sizeHeading ||
            sizeHeading.contains(heading)) {
          sizeHeading = heading;
        }
      }

      if (/^(Select Shade|Choose Shade)$/i.test(headingText)) {
        if (!shadeHeading ||
            shadeHeading.contains(heading)) {
          shadeHeading = heading;
        }
      }
    }

    if (sizeHeading) {
      var hr = sizeHeading.getBoundingClientRect();

      var bestSize = "";
      var bestScore = -1;

      for (var s = 0; s < nodes.length; s++) {
        var el = nodes[s];

        if (!visible(el) || !selectedCard(el)) continue;

        var r = el.getBoundingClientRect();

        if (r.width > 185 || r.height > 150) continue;

        var distance = r.top - hr.bottom;
        if (distance < -20 || distance > 340) continue;

        var value = sizeValue(firstLine(el));
        if (!value) continue;

        var score = 100 -
          Math.min(60, Math.max(0, distance) / 8);

        if (selected(el)) score += 40;

        if (score > bestScore) {
          bestScore = score;
          bestSize = value;
        }
      }

      if (bestSize) add("Size", bestSize);
    }

    // Shades may be represented as swatches with a pink border,
    // while the chosen shade is written into the live title.
    if (shadeHeading) {
      var shadeRect = shadeHeading.getBoundingClientRect();
      var hasSelectedSwatch = false;

      for (var c = 0; c < nodes.length; c++) {
        var swatch = nodes[c];
        if (!visible(swatch) || !selectedCard(swatch)) continue;

        var sr = swatch.getBoundingClientRect();
        var gap = sr.top - shadeRect.bottom;

        if (gap < -20 || gap > 380 ||
            sr.width > 185 || sr.height > 150) continue;

        hasSelectedSwatch = true;

        var shadeValue = clean(
          swatch.getAttribute("aria-label") ||
          swatch.getAttribute("title") || ""
        ).replace(/^(?:Selected\s+)?Shade\s*:?\s*/i, "");

        if (shadeValue && shadeValue.length <= 65 &&
            !/select|all shades|₹|view/i.test(shadeValue)) {
          add("Shade", shadeValue);
          break;
        }
      }

      // Nykaa updates the product title on shade changes.
      // Examples: "Shade-04", "Light Medium", "The MVP 10".
      if (!seen.shade && hasSelectedSwatch) {
        var title = getTitle();
        var dash = title.lastIndexOf(" - ");

        if (dash >= 0) {
          var suffix = clean(title.slice(dash + 3));

          if (suffix && suffix.length <= 65 &&
              !/nykaa|online|buy now/i.test(suffix)) {
            add("Shade", suffix);
          }
        }
      }
    }

    // For certain products the selected shade is already
    // encoded in the current product title, even when the
    // swatch's accessibility attributes are missing.
    if (!seen.shade && shadeHeading) {
      var activeTitle = getTitle();
      var explicit = activeTitle.match(
        /\b(Shade[\s-]*[A-Za-z0-9._-]+)\s*$/i
      );

      if (explicit) {
        add("Shade", explicit[1]);
      }
    }

    // NYKAA_V5_TITLE_SIZE_FALLBACK
    // Extract the currently displayed SKU size.
    // Keep existing swatch and size-card detection.

    if (!seen.size) {
      var productTitle = clean(getTitle());
      var sizeCandidate = "";

      function v5Size(value) {
        value = clean(value).replace(/^\(|\)$/g, "");

        if (/^(?:EURO|EU|UK|US)\s*\d{1,2}(?:\.\d)?$/i.test(value)) {
          return value.toUpperCase().replace(/\s+/g, " ");
        }

        if (/^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|[2-9]XL|10XL|FREE SIZE|ONE SIZE|OS)$/i.test(value)) {
          return value.toUpperCase();
        }

        if (/^\d+(?:\.\d+)?\s*(?:ml|l|gm|g|kg|mg|oz|fl oz|pcs?|pieces?)$/i.test(value)) {
          return value;
        }

        if (/^\d{1,2}(?:\.\d)?$/.test(value)) {
          return value;
        }

        if (/^\d{1,2}\s*-\s*\d{1,2}\s*(?:y|yr|yrs|years)$/i.test(value)) {
          return value.toUpperCase();
        }

        return "";
      }

      var titleMatch = productTitle.match(/\(([^()]{1,40})\)\s*$/);

      if (titleMatch) {
        sizeCandidate = v5Size(titleMatch[1]);
      }

      if (!sizeCandidate) {
        var pageLines = String(
          document.body ? document.body.innerText || "" : ""
        ).split(/\r?\n/).map(clean).filter(Boolean);

        var anchor = productTitle.toLowerCase().slice(0, 35);

        if (anchor.length >= 8) {
          for (var n = 0; n < pageLines.length; n++) {
            if (pageLines[n].toLowerCase().indexOf(anchor) < 0) {
              continue;
            }

            for (
              var next = n + 1;
              next <= n + 2 && next < pageLines.length;
              next++
            ) {
              if (/^\([^()]{1,40}\)$/.test(pageLines[next])) {
                sizeCandidate = v5Size(pageLines[next]);

                if (sizeCandidate) break;
              }
            }

            break;
          }
        }
      }

      if (sizeCandidate) {
        add("Size", sizeCandidate);
      }
    }
    return result;
  }
  // NYKAA_V6_STOCK_VALIDATION
  // Checks the current product and selected SKU only.
  // Low stock is not treated as sold out.
  // NYKAA_V63_SELECTED_STOCK
  // Product-level and selected-SKU validation.
  // Does not use promotional cards as availability evidence.
  function getStockStatus(variants, shadeSoldOut) {
    if (!isProductPage()) {
      return {
        blocked: true,
        reason: "not-product",
        message: "Please open a Nykaa product page."
      };
    }

    function norm(v) {
      return clean(v).toLowerCase()
        .replace(/[\s_-]+/g, "");
    }

    function sold(v) {
      return /^(?:sold\s*out|out\s*of\s*stock|currently\s*unavailable|temporarily\s*unavailable|notify\s*me|notify\s*when\s*available)$/i
        .test(clean(v));
    }

    function low(v) {
      return /^(?:few\s*left|only\s*\d+\s*left!?|\d+\s*left!?|limited\s*stock)$/i
        .test(clean(v));
    }

    var body = document.body;

    if (!body) {
      return {
        blocked: false,
        reason: "stock-not-verified",
        availabilityVerified: false
      };
    }

    var chosenSize = "";
    var chosenShade = "";

    for (var vi = 0; vi < variants.length; vi++) {
      var variant = variants[vi];

      if (/^(size|volume|weight)$/i.test(variant.name)) {
        chosenSize = clean(variant.value);
      }

      if (/^(shade|color|colour)$/i.test(variant.name)) {
        chosenShade = clean(variant.value);
      }
    }

    // NYKAA_V64_SHADE_STOCK
    // The selected shade label explicitly contained Sold Out.
    // This evidence comes from the selected variant, not
    // from a different shade or recommended product.
    if (shadeSoldOut === true && chosenShade) {
      return {
        blocked: true,
        reason: "selected-shade-sold-out",
        message:
          "Nykaa shade " + chosenShade +
          " is sold out. Please select another available shade.",
        evidence: "Sold Out in selected shade label",
        selectedSize: chosenSize,
        selectedShade: chosenShade,
        availabilityVerified: true
      };
    }
    function blocked(reason, evidence) {
      return {
        blocked: true,
        reason: reason,
        message: chosenSize
          ? "Nykaa size " + chosenSize +
            " is sold out. Please choose another available size."
          : "The selected Nykaa product or shade is sold out.",
        evidence: evidence,
        selectedSize: chosenSize,
        selectedShade: chosenShade,
        availabilityVerified: true
      };
    }

    var lines = String(body.innerText || "")
      .split(/\r?\n/)
      .map(clean)
      .filter(Boolean);

    var titleAnchor = norm(getTitle()).slice(0, 30);
    var titleIndex = -1;

    for (var ti = 0; ti < lines.length; ti++) {
      if (titleAnchor.length >= 8 &&
          norm(lines[ti]).indexOf(titleAnchor) >= 0) {
        titleIndex = ti;
        break;
      }
    }

    // FIRST: examine Nykaa's size listing.
    // A size is matched exactly, not by substring.
    if (chosenSize && titleIndex >= 0) {
      var sizeSection = -1;

      for (
        var hi = titleIndex + 1;
        hi < Math.min(lines.length, titleIndex + 55);
        hi++
      ) {
        if (/^(?:select|choose)\s*size$/i.test(lines[hi])) {
          sizeSection = hi;
          break;
        }

        if (/^(?:coupons?|offers?|product details|check delivery)/i
            .test(lines[hi])) {
          break;
        }
      }

      if (sizeSection >= 0) {
        for (
          var si = sizeSection + 1;
          si < Math.min(lines.length, sizeSection + 100);
          si++
        ) {
          var current = lines[si];

          if (/^(?:coupons?|offers?|product details|check delivery|ratings|reviews|size guide)$/i
              .test(current)) {
            break;
          }

          if (norm(current) !== norm(chosenSize)) {
            continue;
          }

          // Only examine the compact size/price/status group.
          // Stop before the following size option.
          var evidence = [current];

          for (
            var next = si + 1;
            next < Math.min(lines.length, si + 5);
            next++
          ) {
            var nextLine = lines[next];

            if (/^(?:coupons?|offers?|product details|check delivery|size chart)$/i
                .test(nextLine)) {
              break;
            }

            // Another size card starts here.
            if (/^(?:EURO|EU|UK|US)\s*\d+(?:\.\d+)?$/i
                .test(nextLine) ||
                /^(?:XXS|XS|S|M|L|XL|XXL|[2-9]XL)$/i
                .test(nextLine)) {
              break;
            }

            if (norm(nextLine) === norm(chosenSize)) {
              break;
            }

            evidence.push(nextLine);

            if (sold(nextLine)) {
              return blocked(
                "selected-size-sold-out",
                evidence.join(" | ")
              );
            }

            if (low(nextLine)) {
              break;
            }

            // Price and stock usually occupy adjacent lines.
            // Do not scan into a distant option.
            if (evidence.length >= 3) {
              break;
            }
          }
        }
      }
    }

    // SECOND: inspect matching size cards in the DOM.
    // This catches stock badges inside the same card.
    if (chosenSize) {
      var nodes = document.querySelectorAll(
        "button, [role='button'], [role='radio'], li, label, div, span"
      );

      var headingBottom = null;

      for (var h = 0; h < nodes.length; h++) {
        var head = nodes[h];
        if (!visible(head)) continue;

        if (/^(?:select|choose)\s*size$/i.test(
          clean(head.innerText || head.textContent)
        )) {
          var headRect = head.getBoundingClientRect();

          if (headRect.width <= 260 &&
              headRect.height <= 85) {
            headingBottom = headRect.bottom;
            break;
          }
        }
      }

      for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        if (!visible(node)) continue;

        var raw = String(
          node.innerText || node.textContent || ""
        );

        var nodeLines = raw.split(/\r?\n/)
          .map(clean).filter(Boolean);

        if (!nodeLines.length ||
            norm(nodeLines[0]) !== norm(chosenSize)) {
          continue;
        }

        var nr = node.getBoundingClientRect();

        if (nr.width > 260 || nr.height > 210) {
          continue;
        }

        if (headingBottom !== null &&
            (nr.top < headingBottom - 30 ||
             nr.top > headingBottom + 750)) {
          continue;
        }

        if (nodeLines.slice(1).some(sold)) {
          return blocked(
            "selected-size-sold-out",
            nodeLines.join(" | ").slice(0, 160)
          );
        }

        var parent = node.parentElement;

        for (var depth = 0; parent && depth < 4; depth++) {
          var pr = parent.getBoundingClientRect();

          // A wrapper for many sizes is not one size card.
          if (pr.width > 270 || pr.height > 230) {
            break;
          }

          var parentLines = String(
            parent.innerText || parent.textContent || ""
          ).split(/\r?\n/).map(clean).filter(Boolean);

          if (parentLines.length &&
              norm(parentLines[0]) === norm(chosenSize) &&
              parentLines.slice(1).some(sold)) {
            return blocked(
              "selected-size-sold-out",
              parentLines.join(" | ").slice(0, 160)
            );
          }

          parent = parent.parentElement;
        }
      }
    }

    // THIRD: selected shade availability near the product title.
    // Avoid matching a sold-out badge from another swatch.
    if (titleIndex >= 0) {
      var before = lines.slice(
        Math.max(0, titleIndex - 4),
        titleIndex
      );

      var shadeMatch = !chosenShade ||
        before.some(function(line) {
          return norm(line) === norm(chosenShade);
        });

      if (shadeMatch && before.some(sold)) {
        return blocked(
          "selected-product-sold-out",
          before.join(" | ")
        );
      }
    }

    // FOURTH: explicit main purchase unavailability.
    var buttons = document.querySelectorAll(
      "button, [role='button']"
    );

    for (var bi = 0; bi < buttons.length; bi++) {
      var button = buttons[bi];
      if (!visible(button)) continue;

      var label = clean(
        button.getAttribute("aria-label") ||
        button.innerText ||
        button.textContent
      );

      if (!sold(label)) continue;

      var rect = button.getBoundingClientRect();
      var viewportHeight =
        window.innerHeight ||
        document.documentElement.clientHeight;

      if (rect.width >= 100 &&
          rect.top >= viewportHeight - 190 &&
          rect.top <= viewportHeight) {
        return blocked(
          "product-sold-out",
          label
        );
      }
    }

    return {
      blocked: false,
      reason: "stock-not-verified",
      availabilityVerified: false,
      selectedSize: chosenSize,
      selectedShade: chosenShade,
      sizeSelectorDetected:
        /(?:select|choose)\s*size/i.test(
          lines.slice(
            Math.max(0, titleIndex),
            titleIndex + 60
          ).join(" ")
        )
    };
  }
  function scrape() {
    var price = getPriceDetails();
    var variants = getVariants();
    var size = "";
    var color = "";

    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];

      if (/^(size|volume|weight)$/i.test(v.name)) {
        size = v.value;
      }

      if (/^(shade|color|colour)$/i.test(v.name)) {
        color = v.value;
      }
    }

    // NYKAA_V64_SHADE_CLEANUP
    // Retain stock evidence before cleaning the cart shade.
    var selectedShadeSoldOut = false;

    for (var sv = 0; sv < variants.length; sv++) {
      var item = variants[sv];

      if (!/^(shade|color|colour)$/i.test(item.name)) {
        continue;
      }

      var rawShade = clean(item.value);

      if (/(?:,\s*|\s+-\s+)(?:Sold\s*Out|Out\s*of\s*Stock)\s*$/i.test(rawShade)) {
        selectedShadeSoldOut = true;
      }

      // NYKAA_V65_LOW_STOCK_CLEANUP
      // Remove stock notices from the displayed shade name.
      // Preserve the original Sold Out detection above.
      var cleanShade = clean(
        rawShade.replace(
          /(?:,\s*|\s+-\s+)(?:Sold\s*Out|Out\s*of\s*Stock|(?:Only\s+)?\d+\s+left!?|Few\s+Left|Limited\s+Stock)\s*$/i,
          ""
        )
      );

      if (cleanShade) {
        item.value = cleanShade;
        color = cleanShade;
      }
    }

    var stock = getStockStatus(variants, selectedShadeSoldOut);

    return {
      adapter: "nykaa",
      store: "Nykaa",
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
      stockStatus: stock,
      __nykaaDebug: {
        version: 2,
        priceSource: price.source,
        // NYKAA_PRICE_PROBE_V3 - read-only diagnostic.
        priceProbeV3: (function() {
          var body = String(
            document.body ? document.body.innerText || "" : ""
          );

          var allLines = body.split(/\r?\n/).map(function(line) {
            return clean(line);
          }).filter(Boolean);

          var title = getTitle();
          var titleAt = -1;

          for (var i = 0; i < allLines.length; i++) {
            if (
              title &&
              allLines[i].toLowerCase().indexOf(
                title.toLowerCase().slice(0, 35)
              ) >= 0
            ) {
              titleAt = i;
              break;
            }
          }

          var titleNode = document.querySelector(
            "[data-testid='product-name'], h1, " +
            "[class*='product-title'], [class*='ProductTitle']"
          );

          var titleRect = titleNode && titleNode.getBoundingClientRect
            ? titleNode.getBoundingClientRect()
            : null;

          var priceNodes = [];
          var elements = document.querySelectorAll(
            "[class*='price'], [class*='Price'], " +
            "[class*='mrp'], [class*='MRP'], strong, b, span"
          );

          for (var j = 0; j < elements.length; j++) {
            var el = elements[j];
            if (!visible(el)) continue;

            var value = clean(el.innerText || el.textContent);
            if (!value || value.length > 90) continue;
            if (!/₹\s*[\d,]+/.test(value)) continue;

            var r = el.getBoundingClientRect();

            priceNodes.push({
              text: value.slice(0, 90),
              tag: el.tagName,
              cls: String(el.className || "").slice(0, 110),
              top: Math.round(r.top),
              distanceFromTitle: titleRect
                ? Math.round(r.top - titleRect.bottom)
                : null,
              decoration: getComputedStyle(el).textDecorationLine
            });

            if (priceNodes.length >= 35) break;
          }

          return {
            productTitle: title,
            titleLine: titleAt,
            nearbyText: titleAt >= 0
              ? allLines.slice(
                  Math.max(0, titleAt - 3),
                  titleAt + 24
                )
              : allLines.slice(0, 25),
            visiblePriceNodes: priceNodes
          };
        })(),
        extractedPrice: price.price,
        title: getTitle(),
        image: getImage(),
        variants: variants,
        selectedSize: size,
        selectedShade: color,
        stock: stock,
        url: String(location.pathname || "")
      }
    };
  }

  window.__miNykaaAdapter = {
    version: 1,
    isProductPage: isProductPage,
    getTitle: getTitle,
    getPrice: function() {
      return getPriceDetails().price;
    },
    getImage: getImage,
    getVariants: getVariants,
    getStockStatus: getStockStatus,
    scrape: scrape
  };
})();
`;