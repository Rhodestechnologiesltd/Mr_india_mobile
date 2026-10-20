/**
 * Myntra product adapter for Mr India.
 *
 * Handles product identification, the current selling price,
 * selected variants, image and availability.
 *
 * Browser navigation, alerts, Odoo conversion and cart handling
 * remain in src/app/browser.tsx.
 */

export const MYNTRA_ADAPTER_JS = String.raw`
(function () {
  if (window.__miMyntraAdapter?.version === 1) return;

  function clean(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }

  function txt(selector) {
    var el = document.querySelector(selector);
    return clean(el && (el.innerText || el.textContent));
  }

  function meta(name) {
    var el = document.querySelector(
      'meta[property="' + name + '"],meta[name="' + name + '"]'
    );
    return clean(el && el.getAttribute("content"));
  }

  function hostOK() {
    return /(^|\.)myntra\.com$/i.test(location.hostname);
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    var style = getComputedStyle(el);

    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) return false;

    return true;
  }

  function isProductPage() {
    if (!hostOK()) return false;

    return (
      !!document.querySelector(".pdp-name, .pdp-title") ||
      /\/buy\b/i.test(location.pathname) ||
      /\/\d{5,}(?:\/|$)/.test(location.pathname)
    );
  }

  function getTitle() {
    var brand = txt(".pdp-title");
    var name = txt(".pdp-name");

    if (brand || name) {
      return clean(brand + " " + name).slice(0, 240);
    }

    return (
      txt("h1") ||
      meta("og:title") ||
      clean(document.title).replace(/\s*\|.*$/, "") ||
      "Myntra product"
    ).slice(0, 240);
  }

  function getImage() {
    var selectors = [
      ".image-grid-image",
      ".pdp-image img",
      ".product-image img",
      "img[src*='assets.myntassets.com']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];

        if (!visible(el)) continue;

        var src =
          el.currentSrc ||
          el.getAttribute("src") ||
          el.getAttribute("data-src") ||
          "";

        if (/^https?:\/\//i.test(src)) return src;

        var style = getComputedStyle(el).backgroundImage || "";
        var match = style.match(/^url\(["']?(.*?)["']?\)$/i);

        if (match && /^https?:\/\//i.test(match[1])) {
          return match[1];
        }
      }
    }

    return meta("og:image") || meta("twitter:image") || "";
  }

  function amount(raw) {
    var match = clean(raw).match(
      /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i
    );

    return match
      ? Number(match[1].replace(/,/g, "")) || 0
      : 0;
  }

  function getPriceDetails() {
    if (!isProductPage()) {
      return { price: 0, source: "not-product" };
    }

    // Prefer Myntra's current selling-price component.
    var selectors = [
      ".pdp-discountedPrice",
      ".pdp-price strong",
      ".pdp-price",
      "[class*='selling-price']",
      "[class*='sellingPrice']",
      "[class*='discountedPrice']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (!visible(el)) continue;

        var content = clean(el.innerText || el.textContent);

        if (
          !content ||
          content.length > 160 ||
          /coupon|cashback|bank offer|get at|effective price|extra off/i
            .test(content)
        ) continue;

        // When a price block contains MRP and sale price,
        // prefer an explicitly marked discounted price.
        var saleNode = el.querySelector(
          ".pdp-discountedPrice, [class*='discountedPrice']"
        );

        if (saleNode && visible(saleNode)) {
          var sale = amount(saleNode.innerText || saleNode.textContent);
          if (sale > 0) {
            return { price: sale, source: "selling-price-child" };
          }
        }

        var priceTokens = content.match(
          /(?:₹|INR|Rs\.?)\s*[\d,]+(?:\.\d{1,2})?/gi
        ) || [];

        if (!priceTokens.length) continue;

        var values = priceTokens
          .map(amount)
          .filter(function (v) { return v > 0; });

        if (!values.length) continue;

        // The displayed sale price is normally below the MRP.
        if (values.length >= 2) {
          return {
            price: Math.min.apply(Math, values),
            source: "selling-price-pair"
          };
        }

        if (
          /pdp-mrp|class.*mrp/i.test(String(el.className || "")) ||
          /^MRP\b/i.test(content)
        ) continue;

        return {
          price: values[0],
          source: "selling-price-element"
        };
      }
    }

    // Do not substitute random prices from recommendations
    // or promotional areas of the page.
    return { price: 0, source: "unverified" };
  }

  function getPrice() {
    return getPriceDetails().price;
  }

  function cleanVariant(raw) {
    return clean(raw)
      .replace(/^(?:selected\s+)?(?:size|colour|color|shade)\s*:\s*/i, "")
      .replace(/\s+(?:size chart|size guide|view similar).*$/i, "")
      .trim();
  }

  function getSelectedSize() {
    var selectors = [
      ".size-buttons-size-button-selected",
      ".size-buttons-selected",
      "[class*='size-button'][class*='selected']",
      "[class*='sizeButton'][class*='selected']",
      "[class*='size'][aria-checked='true']",
      "[class*='size'][aria-selected='true']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (!visible(el)) continue;

        var value = cleanVariant(
          el.getAttribute("aria-label") ||
          el.innerText ||
          el.textContent
        );

        // Reject containers listing several sizes together.
        if (
          value &&
          value.length <= 24 &&
          !/₹|select size|choose size/i.test(value)
        ) return value;
      }
    }

    // Only accept a textual size when explicitly labelled selected.
    var body = clean(document.body && document.body.innerText);
    var match = body.match(
      /Selected Size\s*:\s*([A-Za-z0-9 .\/-]{1,24})/i
    );

    return match ? cleanVariant(match[1]) : "";
  }

  function getSelectedColor() {
    var selectors = [
      ".pdp-colorSelected",
      "[class*='colorSelected']",
      "[class*='colourSelected']",
      "[class*='color'][aria-selected='true']",
      "[class*='colour'][aria-selected='true']",
      "[class*='color'][aria-checked='true']",
      "[class*='colour'][aria-checked='true']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (!visible(el)) continue;

        var value = cleanVariant(
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.innerText ||
          el.textContent
        );

        if (value && value.length <= 50 && !/₹/.test(value)) {
          return value;
        }
      }
    }

    // Some product pages describe the current colour explicitly.
    var body = clean(document.body && document.body.innerText);
    var match = body.match(
      /(?:Selected\s+)?(?:Colour|Color)\s*:\s*([A-Za-z][A-Za-z /-]{1,35}?)(?=\s+(?:Size|MRP|Product Details|Delivery|₹)|$)/i
    );

    return match ? clean(match[1]) : "";
  }

  function getOtherVariants() {
    var variants = [];

    // Only collect additional dimensions when a selected value
    // is clearly labelled, not from ordinary product descriptions.
    var selectors = [
      "[aria-selected='true'][data-variant]",
      "[aria-checked='true'][data-variant]",
      "select[data-variant]"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];

        if (!visible(el)) continue;

        var label = clean(el.getAttribute("data-variant"));
        var value = clean(
          el.value ||
          el.getAttribute("aria-label") ||
          el.innerText
        );

        if (
          label &&
          value &&
          label.length <= 35 &&
          value.length <= 60 &&
          !/^(?:size|color|colour)$/i.test(label)
        ) {
          variants.push({ name: label, value: value });
        }
      }
    }

    return variants;
  }

  function getVariants() {
    var result = [];
    var size = getSelectedSize();
    var color = getSelectedColor();

    if (color) result.push({ name: "Color", value: color });
    if (size) result.push({ name: "Size", value: size });

    return result.concat(getOtherVariants());
  }

  function getStockStatus() {
    // MYNTRA_MOBILE_STOCK_FIX_V1
    // Check only the CURRENT product's primary information area.
    // Do not mistake recommended products for the selected item.
    try {
      if (isProductPage()) {
        var mobile = getMobileMyntraDetails();
        var body = clean(
          document.body ? document.body.innerText || "" : ""
        );

        var productTitle = clean(mobile.title);
        var titlePosition = productTitle
          ? body.toLowerCase().indexOf(productTitle.toLowerCase())
          : -1;

        if (titlePosition >= 0) {
          var section = body.substring(
            titlePosition + productTitle.length,
            titlePosition + productTitle.length + 450
          );

          // Myntra mobile: MRP ₹7,999 Colour Peach OUT OF STOCK
          var currentProductUnavailable =
            /MRP\s*₹\s*[\d,]+(?:\.\d{1,2})?/i.test(section) &&
            /\bOUT\s+OF\s+STOCK\b/i.test(section) &&
            !/ADD\s+TO\s+BAG/i.test(
              section.substring(
                0,
                section.search(/\bOUT\s+OF\s+STOCK\b/i)
              )
            );

          if (currentProductUnavailable) {
            return {
              blocked: true,
              reason: "mobile-current-product-out-of-stock",
              message:
                "This product is out of stock on Myntra. Please choose another available product or colour."
            };
          }
        }
      }
    } catch (err) {
      // Preserve the existing availability checks.
    }
    if (!isProductPage()) {
      return { blocked: false, reason: "not-product" };
    }

    // Strong signals relating to the CURRENT product,
    // not recommendations or unrelated colour swatches.
    var selectors = [
      ".pdp-outOfStock",
      ".pdp-out-of-stock",
      "[class*='pdp-outOfStock']",
      "[class*='pdp-out-of-stock']",
      "[class*='product-outOfStock']"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);

      for (var j = 0; j < nodes.length; j++) {
        if (!visible(nodes[j])) continue;

        var text = clean(nodes[j].innerText || nodes[j].textContent);

        if (/out of stock|sold out|currently unavailable/i.test(text)) {
          return {
            blocked: true,
            reason: "current-product-unavailable",
            message:
              "This selection is unavailable on Myntra. Please choose an available colour or size."
          };
        }
      }
    }

    // A product with selectable sizes but no selection is incomplete.
    var sizeButtons = document.querySelector(
      ".size-buttons-size-container, .size-buttons-container"
    );

    if (sizeButtons && visible(sizeButtons) && !getSelectedSize()) {
      return {
        blocked: true,
        reason: "size-not-selected",
        message: "Please select an available size on Myntra before continuing."
      };
    }

    return {
      blocked: false,
      reason: "no-unavailability-evidence"
    };
  }

  function getMobileMyntraDetails() {
    var result = {
      title: "",
      price: 0,
      image: "",
      size: "",
      color: "",
      priceSource: "not-found"
    };

    var lines = String(
      document.body ? document.body.innerText || "" : ""
    ).split(/\r?\n/).map(clean).filter(Boolean);

    function numberFromText(value) {
      var match = clean(value).match(
        /^[\d,]+(?:\.\d{1,2})?$/
      );
      return match
        ? Number(match[0].replace(/,/g, "")) || 0
        : 0;
    }

    var sizeIndex = -1;

    for (var i = 0; i < lines.length; i++) {
      var sizeMatch = lines[i].match(
        /^Size\s*:\s*(.+)$/i
      );

      if (sizeMatch) {
        var size = clean(sizeMatch[1])
          .replace(/\s+Size Chart.*$/i, "")
          .replace(/\s+BODY:.*$/i, "");

        if (size && size.length <= 55) {
          result.size = size;
          sizeIndex = i;
          break;
        }
      }
    }

    for (var c = 0; c < lines.length; c++) {
      var colorMatch = lines[c].match(
        /^(?:Colour|Color)\s*:?\s+(.{2,45})$/i
      );

      if (
        colorMatch &&
        !/₹|size chart|product details/i.test(colorMatch[1])
      ) {
        result.color = clean(colorMatch[1]);
        break;
      }
    }

    // Find the final product MRP before the active size section.
    var limit = sizeIndex >= 0 ? sizeIndex : lines.length;
    var mrpIndex = -1;

    for (var m = 0; m < limit; m++) {
      if (/^MRP\b/i.test(lines[m])) {
        mrpIndex = m;
      }
    }

    if (mrpIndex >= 0) {
      // Mobile text can be split as:
      // MRP | ₹1,499 | ₹ | 1,124 | (25% OFF)
      var priceParts = [];
      var end = Math.min(lines.length, mrpIndex + 9);

      for (var p = mrpIndex; p < end; p++) {
        if (
          p > mrpIndex &&
          /crazy deal|get at|coupon|bank offer|myncash|emi/i.test(lines[p])
        ) break;

        priceParts.push(lines[p]);

        if (/%\s*OFF/i.test(lines[p])) break;
      }

      var joined = priceParts.join(" ");

      var tokens = joined.match(
        /(?:₹|INR|Rs\.?)\s*[\d,]+(?:\.\d{1,2})?/gi
      ) || [];

      var prices = [];

      for (var t = 0; t < tokens.length; t++) {
        var match = tokens[t].match(
          /[\d,]+(?:\.\d{1,2})?$/
        );

        var price = match
          ? numberFromText(match[0])
          : 0;

        if (price > 0) prices.push(price);
      }

      if (prices.length >= 2) {
        result.price = Math.min.apply(Math, prices);
        result.priceSource = "mobile-mrp-sale-v2";
      } else if (prices.length === 1) {
        // A lone MRP is not sufficient evidence of the
        // actual selling price when a discount is shown.
        if (!/%\s*OFF/i.test(joined)) {
          result.price = prices[0];
          result.priceSource = "mobile-single-price-v2";
        }
      }

      // Product name appears immediately before the MRP.
      for (
        var n = mrpIndex - 1;
        n >= Math.max(0, mrpIndex - 5);
        n--
      ) {
        var candidate = lines[n];

        if (
          candidate.length >= 16 &&
          candidate.length <= 180 &&
          !/₹|MRP|coupon|bank offer|download|crazy deal|^\d+$|^AD$|^View$/i.test(candidate)
        ) {
          result.title = candidate;
          break;
        }
      }
    }

    return result;
  }
  function scrape() {
    var details = getPriceDetails();
    var variants = getVariants();
    var mobile = getMobileMyntraDetails();
    var variants = getVariants();
    if (mobile.color) {
      variants = variants.filter(function(v) {
        return !/^colou?r$/i.test(v.name);
      });
      variants.push({ name: "Color", value: mobile.color });
    }
    if (mobile.size) {
      variants = variants.filter(function(v) {
        return !/^size$/i.test(v.name);
      });
      variants.push({ name: "Size", value: mobile.size });
    }

    return {
      adapter: "myntra",
      store: "Myntra",
      isProductPage: isProductPage(),
      name: mobile.title || getTitle(),
      inr: details.price > 0 ? details.price : mobile.price,
      image: mobile.image || "",
      link: String(location.href || "").split("#")[0],
      variants: variants,
      options: variants.map(function (v) {
        return v.name + ": " + v.value;
      }).join(" | "),
      size: mobile.size || getSelectedSize(),
      color: mobile.color || getSelectedColor(),
      stockStatus: (function () {
        var stock = getStockStatus();
        if (
          stock.reason === "size-not-selected" &&
          mobile.size
        ) {
          return {
            blocked: false,
            reason: "mobile-size-selected"
          };
        }
        return stock;
      })(),
      __myntraDebug: {
        version: 1,
        priceSource: details.source,
        mobilePriceSource: mobile.priceSource,
        mobilePrice: mobile.price,
        mobileTitle: mobile.title,
        mobileSize: mobile.size,
        mobileColor: mobile.color,
        mobileImageFound: !!mobile.image,
        mobileDomProbe: (function () {
          var body = String(
            document.body ? document.body.innerText || "" : ""
          );

          var lines = body.split(/\r?\n/)
            .map(clean)
            .filter(Boolean);

          var priceLines = [];
          for (var i = 0; i < lines.length; i++) {
            if (
              /MRP|₹|price|select size|^size\s*:|^colou?r\b/i.test(lines[i])
            ) {
              priceLines.push({
                line: i,
                text: lines.slice(
                  Math.max(0, i - 2),
                  Math.min(lines.length, i + 3)
                ).join(" | ").slice(0, 300)
              });
            }
            if (priceLines.length >= 16) break;
          }

          var priceNodes = [];
          var nodes = document.querySelectorAll(
            "[class*='price'], [class*='Price'], strong, b"
          );

          for (var j = 0; j < nodes.length; j++) {
            var el = nodes[j];
            var value = clean(el.innerText || el.textContent);

            if (!value || value.length > 130) continue;
            if (!/₹|MRP/i.test(value)) continue;

            priceNodes.push({
              tag: el.tagName,
              cls: String(el.className || "").slice(0, 120),
              text: value.slice(0, 130),
              visible: visible(el)
            });

            if (priceNodes.length >= 15) break;
          }

          var images = [];
          var imageNodes = document.querySelectorAll("img");

          for (var k = 0; k < imageNodes.length; k++) {
            var img = imageNodes[k];
            var source = img.currentSrc ||
              img.getAttribute("src") || "";

            if (!/myntassets|myntra/i.test(source)) continue;

            images.push({
              cls: String(img.className || "").slice(0, 90),
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0,
              src: source.slice(0, 220)
            });

            if (images.length >= 8) break;
          }

          return {
            url: String(location.pathname || ""),
            pageLines: lines.length,
            priceLines: priceLines,
            priceNodes: priceNodes,
            images: images,
            titleNodes: {
              h1: txt("h1"),
              pdpTitle: txt(".pdp-title"),
              pdpName: txt(".pdp-name"),
              documentTitle: clean(document.title)
            }
          };
        })(),
        extractedPrice: details.price,
        variants: variants
      }
    };
  }

  window.__miMyntraAdapter = {
    version: 1,
    isMyntra: hostOK,
    isProductPage: isProductPage,
    getTitle: getTitle,
    getPrice: getPrice,
    getImage: getImage,
    getVariants: getVariants,
    getStockStatus: getStockStatus,
    scrape: scrape
  };
})();
`;
