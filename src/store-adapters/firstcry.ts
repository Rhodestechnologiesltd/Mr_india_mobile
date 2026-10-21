/**
 * FIRSTCRY_ADAPTER_V1
 *
 * Preserve existing selling price.
 * Improve product images and selected variants.
 * Do not modify the FirstCry website.
 */
export const FIRSTCRY_ADAPTER_JS = String.raw`
(function () {
  if (!/(^|\.)firstcry\.com$/i.test(location.hostname)) return;

  if (window.__miFirstCryAdapter &&
      window.__miFirstCryAdapter.version === 1) return;

  function clean(v) {
    return String(v == null ? "" : v)
      .replace(/\s+/g, " ").trim();
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    var s = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 &&
      s.display !== "none" &&
      s.visibility !== "hidden";
  }

  function validImage(url) {
    url = clean(url);

    if (!/^https?:\/\//i.test(url)) return false;

    if (/logo|icon|sprite|place[_-]?holder|banner|favicon|payment|avatar/i.test(url)) {
      return false;
    }

    return /\.(?:jpg|jpeg|png|webp)(?:[?#]|$)/i.test(url);
  }

  function imageInfo() {
    var candidates = [];
    var best = "";
    var bestScore = -9999;

    var meta = document.querySelector(
      'meta[property="og:image"]'
    );

    var metaUrl = clean(
      meta && meta.getAttribute("content")
    );

    var imgs = document.querySelectorAll("img");

    for (var i = 0; i < imgs.length && i < 250; i++) {
      var img = imgs[i];

      var urls = [
        img.currentSrc,
        img.getAttribute("src"),
        img.getAttribute("data-src"),
        img.getAttribute("data-original")
      ];

      var chosen = "";

      for (var j = 0; j < urls.length; j++) {
        var url = clean(urls[j]);

        if (url.indexOf("//") === 0) {
          url = location.protocol + url;
        }

        if (validImage(url)) {
          chosen = url;
          break;
        }
      }

      if (!chosen) continue;

      var score = 0;
      var r = img.getBoundingClientRect();

      if (visible(img)) {
        score += 100;
        score += Math.min(r.width, 500);
        score += Math.min(r.height, 500);
      }

      if (img.naturalWidth > 250) score += 100;
      if (img.naturalHeight > 250) score += 100;

      var parent = img;

      for (var d = 0; parent && d < 5; d++) {
        var cls = clean(parent.className);
        var id = clean(parent.id);

        if (/product.*image|image.*product|gallery|zoom|main.*image|pdp/i.test(cls + " " + id)) {
          score += 180;
        }

        if (/recommend|similar|related|product-card|banner|advert/i.test(cls + " " + id)) {
          score -= 600;
        }

        parent = parent.parentElement;
      }

      candidates.push({
        url: chosen.slice(0, 160),
        score: score
      });

      if (score > bestScore) {
        bestScore = score;
        best = chosen;
      }
    }

    if (validImage(metaUrl) && bestScore < 200) {
      best = metaUrl;
    }

    return {
      url: best,
      source: best ? "image-candidate" : "not-found",
      candidates: candidates
        .sort(function(a, b) { return b.score - a.score; })
        .slice(0, 8)
    };
  }

  function selectedValue(label) {
    var selected = document.querySelectorAll(
      "[aria-selected='true']," +
      "[aria-checked='true']," +
      "input:checked + label," +
      "[class*='selected']," +
      "[class*='Selected']," +
      "[class*='active']," +
      "[class*='Active']"
    );

    var pattern = label === "pack"
      ? /(?:pack\s*(?:of)?\s*\d+|\d+\s*(?:pcs|pieces|diapers))/i
      : label === "size"
      ? /^(?:new\s*born|newborn|small|medium|large|xlarge|xl|xxl|xxxl|nb|s|m|l|xxl|\d+\s*[-–]\s*\d+\s*(?:m|months?|years?)?)$/i
      : null;

    for (var i = 0; i < selected.length && i < 150; i++) {
      var el = selected[i];

      if (!visible(el)) continue;

      var text = clean(
        el.getAttribute("aria-label") ||
        el.innerText ||
        el.textContent
      );

      if (!text || text.length > 50) continue;

      if (pattern && pattern.test(text)) {
        return text;
      }
    }

    return "";
  }

  function selectedPackFromSection() {
    /*
     * Some FirstCry builds identify the selected
     * pack with a border/class instead of aria-selected.
     */
    var headings = document.querySelectorAll(
      "div, span, strong, p, h3, h4"
    );

    for (var i = 0; i < headings.length && i < 500; i++) {
      var h = headings[i];

      if (clean(h.innerText || h.textContent).toLowerCase() !== "pack of") {
        continue;
      }

      var section = h.parentElement;

      if (!section) continue;

      var choices = section.querySelectorAll(
        "button, [role='option'], [role='radio'], li, label, span"
      );

      for (var j = 0; j < choices.length && j < 40; j++) {
        var el = choices[j];
        var text = clean(el.innerText || el.textContent);

        if (!/^(?:pack\s*of\s*)?\d{1,4}$/i.test(text)) continue;

        var classText = clean(el.className).toLowerCase();
        var selectedFlag =
          el.getAttribute("aria-selected") === "true" ||
          el.getAttribute("aria-checked") === "true" ||
          /\bselected\b|\bactive\b|\bchecked\b/.test(classText);

        if (selectedFlag && visible(el)) {
          return /^pack/i.test(text) ? text : "Pack of " + text;
        }
      }
    }

    return "";
  }

  /*
   * FIRSTCRY_PRICE_DIAGNOSTIC_V1
   * Read-only product price inspection.
   */
  function inspectPrice() {
    var nodesFound = [];
    var selectors = [
      ".prod-price",
      "[class*='price']",
      "[class*='Price']",
      "[id*='price']",
      "[id*='Price']",
      "[class*='offer']",
      "[class*='mrp']"
    ];

    var visited = [];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length && j < 80; j++) {
        var el = nodes[j];

        if (visited.indexOf(el) >= 0) continue;
        visited.push(el);

        if (!visible(el)) continue;

        var raw = clean(
          el.innerText || el.textContent || ""
        );

        if (!raw || raw.length > 170) continue;

        if (!/(?:₹|Rs\.?|MRP|price|club)/i.test(raw)) {
          continue;
        }

        nodesFound.push({
          selector: selectors[i],
          tag: el.tagName,
          className: clean(
            typeof el.className === "string"
              ? el.className
              : ""
          ).slice(0, 140),
          id: clean(el.id || ""),
          text: raw.slice(0, 150),
          html: String(el.outerHTML || "").slice(0, 450)
        });

        if (nodesFound.length >= 18) break;
      }

      if (nodesFound.length >= 18) break;
    }

    var lines = document.body
      ? String(document.body.innerText || "")
          .split(/\r?\n/)
          .map(clean)
          .filter(Boolean)
      : [];

    var priceLines = [];

    for (var k = 0; k < lines.length; k++) {
      if (
        /^(?:₹|Rs\.?|MRP|Club Price|Sale price)/i.test(lines[k]) ||
        /per diaper/i.test(lines[k])
      ) {
        priceLines.push({
          line: k,
          before: lines.slice(Math.max(0, k - 2), k),
          text: lines[k].slice(0, 160),
          after: lines.slice(k + 1, k + 3)
        });
      }

      if (priceLines.length >= 12) break;
    }

    return {
      url: location.pathname,
      capturedAt: Date.now(),
      nodes: nodesFound,
      priceLines: priceLines
    };
  }
  /*
   * FIRSTCRY_LIVE_PRICE_V2
   * Read the current product's normal selling price.
   * Rupees and paise are separate HTML elements.
   * Never use MRP, Club Price, offers or cached legacy price.
   */
  function firstCryLivePrice() {
    var selectors = [
      "p.mProdprice .th-discounted-price",
      ".mProdprice .th-discounted-price",
      "p.mProdprice"
    ];

    var examined = [];

    for (var i = 0; i < selectors.length; i++) {
      var containers = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < containers.length && j < 12; j++) {
        var container = containers[j];

        if (!visible(container)) continue;

        var wholeEl = container.querySelector(
          "span.prod-price"
        );

        if (!wholeEl || !visible(wholeEl)) continue;

        var wholeText = "";

        for (var n = 0; n < wholeEl.childNodes.length; n++) {
          var child = wholeEl.childNodes[n];

          if (child.nodeType === 3) {
            wholeText += child.textContent || "";
          }
        }

        if (!clean(wholeText)) {
          wholeText = clean(wholeEl.innerText || "");
        }

        var wholeMatch = clean(wholeText).match(
          /^([\d,]+)(?:\.(\d{1,2}))?$/
        );

        if (!wholeMatch) continue;

        var rupees = Number(wholeMatch[1].replace(/,/g, ""));
        var paise = 0;
        var paiseSource = "none";

        if (wholeMatch[2]) {
          paise = Number(wholeMatch[2].padEnd(2, "0"));
          paiseSource = "decimal";
        } else {
          var sup = container.querySelector("sup");

          if (!sup && wholeEl.nextElementSibling &&
              wholeEl.nextElementSibling.tagName === "SUP") {
            sup = wholeEl.nextElementSibling;
          }

          if (sup) {
            var supText = clean(
              sup.innerText || sup.textContent || ""
            );

            if (/^\d{1,2}$/.test(supText)) {
              paise = Number(supText);
              paiseSource = "sup";
            }
          }
        }

        var price = Math.round(
          (rupees + paise / 100) * 100
        ) / 100;

        examined.push({
          selector: selectors[i],
          whole: wholeText,
          paise: paise,
          paiseSource: paiseSource,
          price: price
        });

        if (isFinite(price) && price > 0) {
          return {
            value: price,
            source: selectors[i],
            examined: examined
          };
        }
      }
    }

    return {
      value: 0,
      source: "live-price-not-found",
      examined: examined
    };
  }
  /*
   * FIRSTCRY_VARIANT_FIX_V2
   * Identify the active size from an individual size option.
   * Avoid reading other available sizes.
   */
  function selectedFirstCrySize() {
    function sizeName(v) {
      v = clean(v);
      var map = {
        "new born": "New Born",
        "newborn": "New Born",
        "small": "Small",
        "medium": "Medium",
        "large": "Large",
        "extra large": "Extra Large",
        "x large": "Extra Large",
        "xlarge": "Extra Large",
        "xl": "XL",
        "xxl": "XXL",
        "xxxl": "XXXL"
      };
      var lower = v.toLowerCase();
      if (map[lower]) return map[lower];
      if (/^(?:xxxs|xxs|xs|s|m|l|xxxxl|free size)$/i.test(v)) return v;
      if (/^(?:eu|uk|us)?\s*\d{1,2}(?:\.\d)?$/i.test(v)) return v;
      if (/^\d{1,2}\s*(?:months?|years?)$/i.test(v)) return v;
      return "";
    }

    function orange(v) {
      v = String(v || "").toLowerCase().replace(/\s+/g, "");
      if (/#(?:f50|ff5|ff6|fc5|ff7)/i.test(v)) return true;
      var m = v.match(/rgba?\((\d+),(\d+),(\d+)/);
      if (!m) return false;
      var r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
      return r >= 190 && g >= 45 && g <= 160 && b <= 110 && r > g * 1.3;
    }

    var headings = document.querySelectorAll(
      "div, span, p, strong, h2, h3, h4, label"
    );
    var best = "";
    var bestScore = 0;

    for (var h = 0; h < headings.length && h < 1000; h++) {
      var heading = headings[h];
      if (clean(heading.innerText || heading.textContent).toLowerCase() !== "size") continue;
      if (!visible(heading)) continue;

      var section = heading.parentElement;
      for (var depth = 0; section && depth < 3; depth++, section = section.parentElement) {
        var nodes = section.querySelectorAll(
          "button, [role='radio'], [role='option'], [role='button'], li, label, span, div"
        );

        for (var i = 0; i < nodes.length && i < 180; i++) {
          var el = nodes[i];
          if (!visible(el)) continue;

          var r = el.getBoundingClientRect();
          if (r.width < 20 || r.width > 180 || r.height < 12 || r.height > 85) continue;

          var value = sizeName(el.innerText || el.textContent);
          if (!value) continue;

          var cls = clean(el.getAttribute("class") || "").toLowerCase();
          var score = 0;

          if (el.getAttribute("aria-selected") === "true") score += 120;
          if (el.getAttribute("aria-checked") === "true") score += 120;
          if (el.getAttribute("data-selected") === "true") score += 120;
          if (/\b(selected|active|checked|chosen)\b/.test(cls)) score += 90;

          try {
            var style = window.getComputedStyle(el);
            if (orange(style.borderTopColor) ||
                orange(style.borderRightColor) ||
                orange(style.borderBottomColor) ||
                orange(style.borderLeftColor)) score += 85;
            if (orange(style.color)) score += 35;
          } catch (e) {}

          var parent = el.parentElement;
          if (parent && clean(parent.innerText || parent.textContent) ===
              clean(el.innerText || el.textContent)) {
            var pc = clean(parent.getAttribute("class") || "").toLowerCase();
            if (/\b(selected|active|checked|chosen)\b/.test(pc)) score += 60;
            try {
              var ps = window.getComputedStyle(parent);
              if (orange(ps.borderTopColor) ||
                  orange(ps.borderRightColor) ||
                  orange(ps.borderBottomColor) ||
                  orange(ps.borderLeftColor)) score += 70;
            } catch (e) {}
          }

          if (score > bestScore) {
            bestScore = score;
            best = value;
          }
        }
        if (bestScore >= 80) break;
      }
      if (bestScore >= 80) break;
    }

    return bestScore >= 60 ? best : "";
  }
  /*
   * FIRSTCRY_VARIANTS_V2_SAFE
   * Read-only extraction of selected capacity, color and pack.
   */

  function fcVariantText(el) {
    if (!el) return "";
    return clean(
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.innerText ||
      el.textContent ||
      ""
    );
  }

  function fcSelected(el) {
    if (!el) return false;

    var candidates = [el, el.parentElement];

    for (var i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (!node) continue;

      if (node.getAttribute("aria-selected") === "true" ||
          node.getAttribute("aria-checked") === "true" ||
          node.getAttribute("data-selected") === "true") {
        return true;
      }

      var cls = clean(node.getAttribute("class") || "");

      if (/(^|[\s_-])(selected|active|checked|chosen)([\s_-]|$)/i.test(cls)) {
        return true;
      }

      try {
        var css = window.getComputedStyle(node);
        var borders = [
          css.borderTopColor,
          css.borderRightColor,
          css.borderBottomColor,
          css.borderLeftColor
        ];

        for (var b = 0; b < borders.length; b++) {
          var color = String(borders[b] || "").toLowerCase();
          var rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);

          if (rgb) {
            var r = Number(rgb[1]);
            var g = Number(rgb[2]);
            var bl = Number(rgb[3]);

            if (r >= 190 && g >= 45 && g <= 170 &&
                bl <= 120 && r > g * 1.3) {
              return true;
            }
          }

          if (/^#(?:ff[56789a-f]|f[56789a-f][0-9a-f]|fc[56789a-f])/i.test(color)) {
            return true;
          }
        }
      } catch (e) {}
    }

    return false;
  }

  function fcCapacity(value) {
    var v = clean(value);
    var m = v.match(/(?:^|[^\w])(\d+(?:\.\d+)?)\s*(ml|millilitres?|milliliters?|litres?|liters?|ltr|l)(?=$|[^\w])/i);
    if (!m) return "";

    var unit = /^(?:l|ltr|lit)/i.test(m[2]) ? "L" : "ml";
    return m[1] + " " + unit;
  }

  function fcSectionSelected(headingPattern, accept) {
    var heads = document.querySelectorAll(
      "h2,h3,h4,h5,strong,label,p,span,div"
    );

    for (var i = 0; i < heads.length && i < 900; i++) {
      var h = heads[i];
      if (!visible(h)) continue;

      var heading = clean(h.innerText || h.textContent);
      if (!headingPattern.test(heading)) continue;

      var scope = h.parentElement;

      for (var depth = 0; scope && depth < 3; depth++, scope = scope.parentElement) {
        var options = scope.querySelectorAll(
          "button,[role='radio'],[role='option'],[aria-selected],[aria-checked],li,label,span,div,img"
        );

        for (var j = 0; j < options.length && j < 140; j++) {
          var el = options[j];
          if (!visible(el) || !fcSelected(el)) continue;

          var value = fcVariantText(el);

          if (el.tagName === "IMG") {
            value = clean(
              el.getAttribute("alt") ||
              el.getAttribute("title") ||
              el.parentElement &&
                (el.parentElement.getAttribute("title") ||
                 el.parentElement.getAttribute("aria-label")) ||
              ""
            );
          }

          var accepted = accept(value);
          if (accepted) return accepted;
        }
      }
    }

    return "";
  }

  function fcSelectedCapacity(legacy, originalOptions) {
    var selected = fcSectionSelected(
      /^(?:size|quantity|capacity|volume|net quantity|pack size)$/i,
      fcCapacity
    );

    if (selected) return { value: selected, source: "selected-option" };

    var fromOptions = clean(originalOptions).match(
      /(?:size|capacity|quantity|volume)\s*:\s*([^|,;]+?)(?=\s+-\s+(?:size|color|colour|pack)\s*:|$)/i
    );

    if (fromOptions) {
      var optionCapacity = fcCapacity(fromOptions[1]);
      if (optionCapacity) {
        return { value: optionCapacity, source: "legacy-options" };
      }
    }

    var titleCapacity = fcCapacity(legacy.name || "");

    if (titleCapacity) {
      return { value: titleCapacity, source: "product-name" };
    }

    return { value: "", source: "not-found" };
  }

  /*
   * FIRSTCRY_COLOR_SWATCH_DIAGNOSTIC_V1
   * Read-only inspection of product color thumbnails.
   */
  function fcColorSwatchDiagnostic() {
    var headings = document.querySelectorAll(
      "h2,h3,h4,h5,strong,label,p,span,div"
    );

    var result = {
      url: location.pathname,
      headingFound: false,
      swatches: []
    };

    for (var i = 0; i < headings.length && i < 1200; i++) {
      var heading = headings[i];

      if (!visible(heading)) continue;

      var headingText = clean(
        heading.innerText || heading.textContent
      );

      if (!/^(color|colour|colors|colours)$/i.test(headingText)) {
        continue;
      }

      result.headingFound = true;

      var scope = heading.parentElement;

      for (var depth = 0; scope && depth < 4; depth++) {
        var images = scope.querySelectorAll("img");

        if (images.length >= 2) break;

        scope = scope.parentElement;
      }

      if (!scope) break;

      var images = scope.querySelectorAll("img");

      for (var j = 0; j < images.length && j < 20; j++) {
        var img = images[j];

        if (!visible(img)) continue;

        var parent = img.parentElement;
        var grandparent = parent && parent.parentElement;

        var nodes = [img, parent, grandparent];
        var details = [];

        for (var k = 0; k < nodes.length; k++) {
          var el = nodes[k];

          if (!el) continue;

          var css = window.getComputedStyle(el);

          details.push({
            tag: el.tagName,
            className: clean(el.getAttribute("class") || "").slice(0, 130),
            title: clean(el.getAttribute("title") || ""),
            ariaLabel: clean(el.getAttribute("aria-label") || ""),
            ariaSelected: el.getAttribute("aria-selected"),
            ariaChecked: el.getAttribute("aria-checked"),
            dataSelected: el.getAttribute("data-selected"),
            selectedByCurrentHelper: fcSelected(el),
            borderTop: css.borderTopColor,
            borderRight: css.borderRightColor,
            borderBottom: css.borderBottomColor,
            borderLeft: css.borderLeftColor,
            outline: css.outlineColor,
            html: String(el.outerHTML || "").slice(0, 550)
          });
        }

        result.swatches.push({
          index: j,
          alt: clean(img.getAttribute("alt") || ""),
          title: clean(img.getAttribute("title") || ""),
          src: clean(
            img.currentSrc ||
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            ""
          ).slice(0, 220),
          details: details
        });

        if (result.swatches.length >= 12) break;
      }

      break;
    }

    return result;
  }
  /*
   * FIRSTCRY_COLOR_SWATCH_V3
   * Read the active FirstCry color image.
   * Do not trust labels shared by every swatch.
   */
  function fcSelectedColor(legacy, originalOptions) {
    var swatches = document.querySelectorAll(
      "img.colorimage, img[class*='colorimage']"
    );

    var active = null;
    var details = [];

    function colorFromLabel(value) {
      value = clean(value);
      var matches = value.match(/\(([^()]{2,45})\)\s*$/);
      if (!matches) return "";
      var color = clean(matches[1]);
      if (fcCapacity(color)) return "";
      if (/^\d/.test(color)) return "";
      return color;
    }

    for (var i = 0; i < swatches.length && i < 35; i++) {
      var img = swatches[i];
      if (!visible(img)) continue;

      var selected = fcSelected(img);
      var label = clean(
        img.getAttribute("title") ||
        img.getAttribute("alt") || ""
      );
      var color = colorFromLabel(label);

      details.push({
        selected: selected,
        color: color,
        src: clean(img.getAttribute("src") || "").slice(0, 160)
      });

      if (selected && !active) {
        active = { color: color, label: label };
      }
    }

    var uniqueColors = [];
    for (var j = 0; j < details.length; j++) {
      var candidate = details[j].color;
      if (candidate && uniqueColors.indexOf(candidate) < 0) {
        uniqueColors.push(candidate);
      }
    }

    var chosenColor = "";
    var source = "not-found";

    if (active && active.color && uniqueColors.length > 1) {
      chosenColor = active.color;
      source = "selected-swatch-unique-label";
    }

    if (!chosenColor) {
      var optionMatch = clean(originalOptions).match(
        /(?:color|colour)\s*:\s*(.+?)(?=\s+-\s+(?:size|pack|capacity)\s*:|$)/i
      );

      if (optionMatch) {
        var optionColor = clean(optionMatch[1]);
        if (!fcCapacity(optionColor) && optionColor.length <= 45) {
          chosenColor = optionColor;
          source = "legacy-options";
        }
      }
    }

    if (!chosenColor) {
      var oldColor = clean(legacy.color || "");
      if (oldColor && !fcCapacity(oldColor)) {
        chosenColor = oldColor;
        source = "legacy-color";
      }
    }

    window.__miFirstCryColorDiagnostic = {
      swatchCount: details.length,
      activeSwatchFound: !!active,
      uniqueLabels: uniqueColors,
      selectedColor: chosenColor,
      colorSource: source,
      swatches: details
    };

    return { value: chosenColor, source: source };
  }
  function fcMeaningfulPack(value) {
    value = clean(value);

    if (!value ||
        /^(?:pack\s*(?:of)?\s*1|single|1\s*(?:pc|piece))$/i.test(value)) {
      return "";
    }

    return value;
  }
  function scrape() {
    var legacy = {};

    try {
      if (typeof window.__miScrape === "function") {
        legacy = window.__miScrape() || {};
      }
    } catch (e) {}

    var result = {};

    for (var key in legacy) {
      if (Object.prototype.hasOwnProperty.call(legacy, key)) {
        result[key] = legacy[key];
      }
    }

    var photo = imageInfo();
    if (photo.url) result.image = photo.url;
    else if (!validImage(result.image)) result.image = "";

    var originalOptions = clean(result.options || "");

    var size = selectedFirstCrySize() || clean(result.size || "");
    if (!size) size = selectedValue("size");

    var capacityInfo = fcSelectedCapacity(legacy, originalOptions);
    var colorInfo = fcSelectedColor(legacy, originalOptions);

    var capacity = capacityInfo.value;
    var colour = colorInfo.value;

    if (fcCapacity(size)) {
      capacity = fcCapacity(size);
      size = "";
    }

    if (fcCapacity(colour)) {
      capacity = fcCapacity(colour);
      colour = "";
    }

    var pack = fcMeaningfulPack(
      selectedValue("pack") || selectedPackFromSection()
    );

    if (!pack) {
      var oldPack = originalOptions.match(
        /Pack:\s*(.+?)(?=\s+-\s+(?:size|color|colour|capacity)\s*:|$)/i
      );

      if (oldPack) {
        pack = fcMeaningfulPack(oldPack[1]);
      }
    }

    var options = [];

    if (size) options.push("Size: " + size);
    if (capacity) options.push("Capacity: " + capacity);
    if (colour) options.push("Color: " + colour);
    if (pack) options.push("Pack: " + pack);

    result.options = options.join(" - ");
    result.size = size || capacity;
    result.color = colour;
    result.pack = pack;
    result.__fcVariantInfo = {
      capacity: capacity,
      capacitySource: capacityInfo.source,
      colorSource: colorInfo.source
    };

    result.adapter = "firstcry";
    result.store = "FirstCry";
    result.link = String(location.href || "").split("#")[0];

    /*
     * Preserve the proven legacy selling price.
     * Never replace it with MRP or club/coupon price.
     */
    var currentSellingPrice = firstCryLivePrice();
    result.inr = currentSellingPrice.value;

    result.__firstcryDebug = {
      priceDiagnostic: inspectPrice(),
      colorSwatchDiagnostic: fcColorSwatchDiagnostic(),
      version: 1,
      url: location.pathname,
      legacyPrice: legacy.inr || 0,
      sellingPrice: result.inr,
      livePriceSource: currentSellingPrice.source,
      livePriceNodes: currentSellingPrice.examined,
      name: result.name || "",
      image: result.image || "",
      imageSource: photo.source,
      imageCandidates: photo.candidates,
      size: result.size,
      color: result.color,
      colorSwatchResult: window.__miFirstCryColorDiagnostic || null,
      pack: pack,
      options: result.options
    };

    return result;
  }

  window.__miFirstCryAdapter = {
    version: 1,
    scrape: scrape
  };
})();
`;