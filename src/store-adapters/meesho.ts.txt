/**
 * MEESHO_PHASE2_ADAPTER_V1
 *
 * Meesho product extraction and diagnostics.
 *
 * Browsing, navigation, authentication restrictions
 * and store purchase blocking remain in browser.tsx.
 *
 * Do not mutate the Meesho website.
 */

export const MEESHO_ADAPTER_JS = String.raw`
(function () {
  if (!/(^|\.)meesho\.com$/i.test(location.hostname)) return;

  if (window.__miMeeshoAdapter &&
      window.__miMeeshoAdapter.version === 3) return;

  function clean(v) {
    return String(v == null ? "" : v)
      .replace(/\s+/g, " ").trim();
  }

  function meta(key) {
    var el = document.querySelector(
      'meta[property="' + key + '"],meta[name="' + key + '"]'
    );
    return clean(el && el.getAttribute("content"));
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;

    var r = el.getBoundingClientRect();
    var s = window.getComputedStyle(el);

    return r.width > 0 &&
      r.height > 0 &&
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      Number(s.opacity) !== 0;
  }

  function isProductPage() {
    return /\/p\/[a-z0-9]+(?:\/|$)/i.test(location.pathname);
  }

  function getTitle() {
    var h1 = document.querySelector("h1");
    var title = clean(h1 && (h1.innerText || h1.textContent));

    return (
      title ||
      meta("og:title") ||
      clean(document.title).replace(/\s*\|.*$/, "")
    ).slice(0, 240);
  }

  function getImage() {
    var og = meta("og:image");
    if (/^https?:\/\//i.test(og)) return og;

    var images = document.querySelectorAll("img");
    var best = "";
    var score = -1;

    for (var i = 0; i < images.length; i++) {
      var img = images[i];

      var src = clean(
        img.currentSrc ||
        img.getAttribute("src") ||
        img.getAttribute("data-src")
      );

      if (!/^https?:\/\//i.test(src)) continue;
      if (/logo|banner|icon|sprite|placeholder/i.test(src)) continue;

      var s = 0;

      if (visible(img)) {
        var r = img.getBoundingClientRect();
        s += Math.min(r.width, 500);
        s += Math.min(r.height, 500);
      }

      if (img.naturalWidth >= 300) s += 50;

      if (s > score) {
        score = s;
        best = src;
      }
    }

    return best;
  }

  function priceProbe() {
    var raw = String(
      document.body ? document.body.innerText || "" : ""
    );

    var lines = raw.split(/\r?\n/)
      .map(clean)
      .filter(Boolean);

    var title = getTitle();
    var anchor = title.toLowerCase().slice(0, 25);
    var titleIndex = -1;

    if (anchor.length >= 8) {
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().indexOf(anchor) >= 0) {
          titleIndex = i;
          break;
        }
      }
    }

    var nearby = titleIndex >= 0
      ? lines.slice(
          Math.max(0, titleIndex - 4),
          Math.min(lines.length, titleIndex + 35)
        )
      : lines.slice(0, 35);

    var prices = [];
    var elements = document.querySelectorAll(
      "[data-testid*='price'],[class*='price']," +
      "[class*='Price'],strong,b,span"
    );

    for (var j = 0; j < elements.length; j++) {
      var el = elements[j];
      if (!visible(el)) continue;

      var value = clean(el.innerText || el.textContent);

      if (!value || value.length > 75) continue;
      if (!/(?:₹|INR|Rs\.?)\s*[\d,]+/i.test(value)) continue;

      var rect = el.getBoundingClientRect();

      prices.push({
        text: value.slice(0, 75),
        cls: clean(el.getAttribute("class")).slice(0, 90),
        top: Math.round(rect.top),
        decoration: getComputedStyle(el).textDecorationLine
      });

      if (prices.length >= 25) break;
    }

    return {
      titleLine: titleIndex,
      nearbyText: nearby,
      visiblePriceNodes: prices
    };
  }

  function selectedProbe() {
    var matches = [];
    var nodes = document.querySelectorAll(
      "button,[role='radio'],[role='option']," +
      "[aria-selected='true'],[aria-checked='true']," +
      "[data-selected='true'],[class*='selected']"
    );

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visible(el)) continue;

      var r = el.getBoundingClientRect();
      if (r.width > 350 || r.height > 160) continue;

      var label = clean(
        el.getAttribute("aria-label") ||
        el.innerText ||
        el.textContent
      );

      if (!label || label.length > 85) continue;

      matches.push({
        text: label,
        cls: clean(el.getAttribute("class")).slice(0, 100),
        ariaSelected: el.getAttribute("aria-selected"),
        ariaChecked: el.getAttribute("aria-checked"),
        dataSelected: el.getAttribute("data-selected")
      });

      if (matches.length >= 25) break;
    }

    return matches;
  }

  function cleanVariant(v) {
    var result = clean(v)
      .replace(/\s*(?:₹|INR|Rs\.?)\s*[\d,]+.*$/i, "")
      .replace(/,\s*(?:sold out|out of stock)$/i, "")
      .trim();

    if (/^(?:free|free size)$/i.test(result)) {
      return "Free Size";
    }

    return result;
  }

  function normalizeVariants(legacy) {
    var result = [];
    var seen = {};

    function add(name, value) {
      name = clean(name);
      value = cleanVariant(value);

      if (!name || !value || value.length > 85) return;

      var key = name.toLowerCase();
      if (seen[key]) return;

      seen[key] = true;
      result.push({ name: name, value: value });
    }

    if (Array.isArray(legacy.variants)) {
      for (var i = 0; i < legacy.variants.length; i++) {
        var item = legacy.variants[i];

        if (item && item.name && item.value) {
          add(item.name, item.value);
        }
      }
    }

    if (!seen.size && legacy.size) {
      add("Size", legacy.size);
    }

    if (!seen.color && !seen.colour && legacy.color) {
      add("Color", legacy.color);
    }

    if (!result.length && legacy.options) {
      var chunks = String(legacy.options).split(/\s*\|\s*/);

      for (var j = 0; j < chunks.length; j++) {
        var m = chunks[j].match(
          /^\s*(Size|Color|Colour|Shade|Pack|Capacity|Weight|Style)\s*:\s*(.+)$/
        );

        if (m) add(m[1], m[2]);
      }
    }

    return result;
  }

  /*
   * MEESHO_VARIANTS_V2
   *
   * Extract the actively selected Meesho size chip.
   * The chip can contain both size and a variant price.
   * Never mistake the price for part of the size.
   *
   * This does not perform stock verification.
   */

  function selectedSizeChip() {
    var chips = document.querySelectorAll(
      "[class*='SingleChip__StyledChip']"
    );

    var selected = [];

    function isPink(cssColor) {
      var match = String(cssColor || "").match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
      );

      if (!match) return false;

      var r = Number(match[1]);
      var g = Number(match[2]);
      var b = Number(match[3]);

      return r >= 100 &&
        r > g * 1.4 &&
        b >= 70 &&
        b > g * 1.2;
    }

    function chipIsUnavailable(chip) {
      if (!chip) return false;

      if (
        chip.getAttribute("aria-disabled") === "true" ||
        chip.getAttribute("data-disabled") === "true" ||
        chip.hasAttribute("disabled")
      ) {
        return true;
      }

      var nodes = [chip];
      var children = chip.querySelectorAll("*");

      for (var k = 0; k < children.length && k < 30; k++) {
        nodes.push(children[k]);
      }

      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];

        if (
          node.getAttribute("aria-disabled") === "true" ||
          node.getAttribute("data-disabled") === "true" ||
          node.hasAttribute("disabled")
        ) {
          return true;
        }

        var css = window.getComputedStyle(node);
        var decoration = String(
          css.textDecorationLine || css.textDecoration || ""
        ).toLowerCase();

        if (decoration.indexOf("line-through") >= 0) {
          return true;
        }
      }

      return false;
    }

    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];

      if (!visible(chip)) continue;

      var raw = clean(
        chip.innerText || chip.textContent || ""
      );

      // The label is before the per-size rupee amount.
      var label = cleanVariant(raw);

      // Accept size labels only, not arbitrary page text.
      // MEESHO_MONTH_SIZES_V3_1
      // Includes baby age ranges such as 0-3 Months.
      if (!/^(?:free size|one size|xs|s|m|l|xl|xxl|xxxl|xxxxl|[2-9]xl|ind\s*[- ]\s*\d{1,2}|uk\s*[- ]\s*\d{1,2}|eu\s*[- ]\s*\d{2}|\d{1,3}(?:\.\d+)?|\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:months?|years?))$/i.test(label)) {
        continue;
      }

      var style = window.getComputedStyle(chip);

      var cls = clean(
        chip.getAttribute("class") || ""
      );

      var ariaSelected =
        chip.getAttribute("aria-selected") === "true" ||
        chip.getAttribute("aria-checked") === "true" ||
        chip.getAttribute("data-selected") === "true";

      var selectedClass =
        /(?:^|\s)(?:selected|active)(?:\s|$)/i.test(cls);

      var pinkBorder =
        isPink(style.borderColor) ||
        isPink(style.borderTopColor) ||
        isPink(style.outlineColor);

      var pinkBackground = isPink(style.backgroundColor);

      var chosen =
        ariaSelected ||
        selectedClass ||
        pinkBorder ||
        pinkBackground;

      if (!chosen) continue;

      selected.push({
        size: label,
        raw: raw,
        className: cls.slice(0, 120),
        evidence: ariaSelected
          ? "aria"
          : selectedClass
            ? "class"
            : pinkBorder
              ? "pink-border"
              : "pink-background",
        unavailable: chipIsUnavailable(chip)
      });
    }

    // More than one candidate is ambiguous.
    // Keep the previous extraction as fallback.
    if (selected.length !== 1) {
      return {
        size: "",
        evidence: selected.length
          ? "ambiguous-selection"
          : "no-selected-chip",
        candidateCount: selected.length
      };
    }

    return selected[0];
  }
  /*
   * MEESHO_UNAVAILABLE_SIZE_V3
   *
   * Detect explicit unavailable-size messages within
   * the current product's size-selection section.
   *
   * Do not infer stock from grey styling alone.
   * Does not affect website browsing or size selection.
   */

  function unavailableSizeMessage() {
    if (!isProductPage()) return "";

    var body = clean(
      document.body ? document.body.innerText || "" : ""
    );

    var lower = body.toLowerCase();
    var start = lower.indexOf("select size");

    if (start < 0) return "";

    var section = body.substring(start, start + 1600);
    var end = section.toLowerCase().indexOf("sold by");

    if (end >= 0) {
      section = section.substring(0, end);
    }

    var match = section.match(
      /\bSize\s+([A-Z0-9][A-Z0-9 -]{0,25}?)\s+is\s+not\s+available\b/i
    );

    if (match) {
      return "Size " + clean(match[1]) + " is not available";
    }

    var selectedUnavailable = section.match(
      /\bSelected\s+size\s+(?:is\s+)?(?:out\s+of\s+stock|unavailable)\b/i
    );

    if (selectedUnavailable) {
      return "Selected size is unavailable";
    }

    return "";
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

    var variants = normalizeVariants(legacy);

    var size = cleanVariant(legacy.size || "");
    var color = cleanVariant(legacy.color || "");

    for (var i = 0; i < variants.length; i++) {
      if (/^size$/i.test(variants[i].name)) {
        size = cleanVariant(variants[i].value);
      }

      if (/^(color|colour|shade)$/i.test(variants[i].name)) {
        color = variants[i].value;
      }
    }

    var selectedChip = selectedSizeChip();
    var unavailableMessage = unavailableSizeMessage();

    // Block a selected chip explicitly marked unavailable.
    if (selectedChip.size && selectedChip.unavailable) {
      unavailableMessage =
        "Size " + selectedChip.size + " is not available";
    }

    if (selectedChip.size) {
      size = selectedChip.size;

      var foundSize = false;

      for (var j = 0; j < variants.length; j++) {
        if (/^size$/i.test(variants[j].name)) {
          variants[j].value = size;
          foundSize = true;
          break;
        }
      }

      if (!foundSize) {
        variants.push({
          name: "Size",
          value: size
        });
      }
    }

    var price = Number(legacy.inr || 0);
    if (!isFinite(price) || price <= 0) price = 0;

    var title = clean(legacy.name || getTitle());
    var image = clean(legacy.image || getImage());

    var options = variants.length
      ? variants.map(function(v) {
          return v.name + ": " + v.value;
        }).join(" | ")
      : clean(legacy.options || "");

    return {
      adapter: "meesho",
      store: "Meesho",
      isProductPage: isProductPage(),
      name: title,
      inr: isProductPage() ? price : 0,
      image: image,
      link: String(location.href || "").split("#")[0],
      variants: variants,
      options: options,
      size: size,
      color: color,

      // V3 blocks explicit Meesho unavailable-size messages.
      // All other stock statuses remain unverified.
      stockStatus: {
        blocked: !isProductPage() || !!unavailableMessage,
        reason: !isProductPage()
          ? "not-product"
          : unavailableMessage
            ? "unavailable-size"
            : "stock-not-verified",
        availabilityVerified: !!unavailableMessage,
        message: !isProductPage()
          ? "Please open a Meesho product page."
          : unavailableMessage || ""
      },

      __meeshoDebug: {
        version: 3,
        productPage: isProductPage(),
        priceSource: "legacy-browser-baseline",
        extractedPrice: price,
        title: title,
        image: image,
        variants: variants,
        options: options,
        size: size,
        color: color,
        priceProbe: priceProbe(),
        selectedControls: selectedProbe(),
        selectedSizeChip: selectedChip,
        unavailableSizeMessage: unavailableMessage,
        stockBlocked: !!unavailableMessage,
        url: String(location.pathname || "")
      }
    };
  }

  window.__miMeeshoAdapter = {
    version: 3,
    isProductPage: isProductPage,
    scrape: scrape
  };
})();
`;