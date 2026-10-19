// src/store-adapters/amazon.ts
//
// Amazon-specific product extraction used by the Mr India store browser.
//
// IMPORTANT:
// - This file does NOT render React UI.
// - It runs inside the Amazon WebView page.
// - Amazon browsing and variant selection remain controlled by Amazon.
// - Mr India only reads the selected product when the shopper taps
//   "Shop via Mr India".

export const AMAZON_ADAPTER_JS = String.raw`
(function () {
  if (window.__miAmazonAdapterInstalled) {
    return;
  }

  window.__miAmazonAdapterInstalled = true;

  function clean(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function meta(name) {
    try {
      var el =
        document.querySelector('meta[property="' + name + '"]') ||
        document.querySelector('meta[name="' + name + '"]');

      return el
        ? clean(el.getAttribute("content") || "")
        : "";
    } catch (err) {
      return "";
    }
  }

  function text(selector) {
    try {
      var el = document.querySelector(selector);

      if (!el) {
        return "";
      }

      return clean(
        el.innerText ||
        el.textContent ||
        ""
      );
    } catch (err) {
      return "";
    }
  }

  function attr(selector, attribute) {
    try {
      var el = document.querySelector(selector);

      if (!el) {
        return "";
      }

      return clean(
        el.getAttribute(attribute) || ""
      );
    } catch (err) {
      return "";
    }
  }

  function isAmazon() {
    var host = String(
      location.hostname || ""
    ).toLowerCase();

    return (
      host.indexOf("amazon.") >= 0 ||
      host.indexOf("amazon.in") >= 0
    );
  }

  function isProductPage() {
    if (!isAmazon()) {
      return false;
    }

    var path = String(
      location.pathname || ""
    ).toLowerCase();

    if (
      path.indexOf("/dp/") >= 0 ||
      path.indexOf("/gp/product/") >= 0 ||
      path.indexOf("/gp/aw/d/") >= 0
    ) {
      return true;
    }

    return !!(
      document.querySelector("#productTitle") ||
      document.querySelector("#title") ||
      document.querySelector("[data-feature-name='title']")
    );
  }

  function cleanTitle(value) {
    var title = clean(value);

    if (!title) {
      return "";
    }

    title = title
      .replace(/^Amazon\.in\s*:\s*/i, "")
      .replace(/\s*:\s*Amazon\.in.*$/i, "")
      .replace(/\s*\|\s*Amazon.*$/i, "")
      .trim();

    var lower = title.toLowerCase();

    var rejected = [
      "shopping cart",
      "amazon sign in",
      "customer reviews",
      "added to cart",
      "buy now",
      "secure transaction",
      "product gallery",
      "image gallery"
    ];

    for (var i = 0; i < rejected.length; i++) {
      if (lower.indexOf(rejected[i]) >= 0) {
        return "";
      }
    }

    if (title.length > 240) {
      title = title.substring(0, 240);
    }

    return title;
  }

  function getTitle() {
    var candidates = [
      text("#productTitle"),
      text("#title span"),
      text("#title"),
      text("[data-feature-name='title'] h1"),
      text("h1.a-size-large"),
      meta("og:title"),
      meta("twitter:title"),
      document.title
    ];

    for (var i = 0; i < candidates.length; i++) {
      var title = cleanTitle(
        candidates[i]
      );

      if (title) {
        return title;
      }
    }

    return "Amazon product";
  }

  function normalizeImage(value) {
    var result = clean(value);

    if (!result) {
      return "";
    }

    if (result.indexOf("//") === 0) {
      result =
        location.protocol + result;
    }

    return result;
  }

  function getImage() {
    var image =
      attr("#landingImage", "data-old-hires") ||
      attr("#landingImage", "src") ||
      attr("#imgTagWrapperId img", "data-old-hires") ||
      attr("#imgTagWrapperId img", "src") ||
      attr("#main-image", "src") ||
      meta("og:image") ||
      meta("twitter:image");

    return normalizeImage(image);
  }

  function parseMoney(value) {
    var textValue = clean(value);

    if (!textValue) {
      return 0;
    }

    var match = textValue.match(
      /(?:\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i
    );

    if (!match || !match[1]) {
      return 0;
    }

    var amount = parseFloat(
      match[1].replace(/,/g, "")
    );

    return (
      isFinite(amount) &&
      amount > 0
    )
      ? amount
      : 0;
  }

  function priceFromSelectors(selectors) {
    for (
      var i = 0;
      i < selectors.length;
      i++
    ) {
      var nodes =
        document.querySelectorAll(
          selectors[i]
        );

      for (
        var j = 0;
        j < nodes.length;
        j++
      ) {
        var node = nodes[j];

        var value = parseMoney(
          node.innerText ||
          node.textContent ||
          ""
        );

        if (value > 0) {
          return value;
        }
      }
    }

    return 0;
  }

  function getStructuredPrice() {
    try {
      var metaPrice =
        meta("product:price:amount") ||
        meta("og:price:amount");

      if (metaPrice) {
        var parsedMeta = parseFloat(
          String(metaPrice).replace(
            /,/g,
            ""
          )
        );

        if (
          isFinite(parsedMeta) &&
          parsedMeta > 0
        ) {
          return parsedMeta;
        }
      }

      var scripts =
        document.querySelectorAll(
          'script[type="application/ld+json"]'
        );

      for (
        var i = 0;
        i < scripts.length;
        i++
      ) {
        try {
          var parsed = JSON.parse(
            scripts[i].textContent ||
            scripts[i].innerText ||
            "{}"
          );

          var queue =
            Array.isArray(parsed)
              ? parsed.slice()
              : [parsed];

          while (queue.length) {
            var node = queue.shift();

            if (
              !node ||
              typeof node !== "object"
            ) {
              continue;
            }

            if (node.offers) {
              var offers =
                Array.isArray(node.offers)
                  ? node.offers
                  : [node.offers];

              for (
                var j = 0;
                j < offers.length;
                j++
              ) {
                var raw =
                  offers[j] &&
                  (
                    offers[j].price ||
                    offers[j].lowPrice
                  );

                var amount = parseFloat(
                  String(raw || "")
                    .replace(/,/g, "")
                );

                if (
                  isFinite(amount) &&
                  amount > 0
                ) {
                  return amount;
                }
              }
            }

            for (var key in node) {
              if (
                !Object.prototype.hasOwnProperty.call(
                  node,
                  key
                )
              ) {
                continue;
              }

              var child = node[key];

              if (
                child &&
                typeof child === "object"
              ) {
                if (Array.isArray(child)) {
                  for (
                    var c = 0;
                    c < child.length;
                    c++
                  ) {
                    queue.push(
                      child[c]
                    );
                  }
                } else {
                  queue.push(child);
                }
              }
            }
          }
        } catch (err) {}
      }
    } catch (err) {}

    return 0;
  }

  function getPrice() {
    /*
     * Amazon updates these DOM sections when a shopper changes
     * size, colour, style, capacity, pack, configuration, etc.
     *
     * The live page therefore wins over structured metadata.
     */
    var livePrice =
      priceFromSelectors([
        ".priceToPay .a-offscreen",
        ".priceToPay",
        "#corePriceDisplay_mobile_feature_div .a-price .a-offscreen",
        "#corePriceDisplay_mobile_feature_div .a-price",
        "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
        "#corePriceDisplay_desktop_feature_div .a-price",
        "#corePrice_feature_div .a-price .a-offscreen",
        "#corePrice_feature_div .a-price",
        "#apex_desktop .a-price .a-offscreen",
        "#apex_desktop .a-price",
        "#apex_mobile .a-price .a-offscreen",
        "#apex_mobile .a-price",
        "#tp_price_block_total_price_ww .a-offscreen",
        "#priceblock_dealprice",
        "#priceblock_saleprice",
        "#priceblock_ourprice"
      ]);

    if (livePrice > 0) {
      return livePrice;
    }

    return getStructuredPrice();
  }

  function titleCaseDimension(value) {
    var result = clean(value)
      .replace(/^variation[_-]*/i, "")
      .replace(/^inline[-_]?twister[-_]*/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\bname\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!result) {
      return "Option";
    }

    var known = {
      "size": "Size",
      "color": "Color",
      "colour": "Color",
      "style": "Style",
      "capacity": "Capacity",
      "storage": "Storage",
      "configuration": "Configuration",
      "pattern": "Pattern",
      "flavor": "Flavor",
      "flavour": "Flavor",
      "weight": "Weight",
      "model": "Model",
      "edition": "Edition",
      "pack": "Pack",
      "pack size": "Pack Size",
      "number of items": "Number of Items",
      "item package quantity": "Pack Quantity"
    };

    var lower =
      result.toLowerCase();

    if (known[lower]) {
      return known[lower];
    }

    return result
      .split(" ")
      .map(function (word) {
        if (!word) {
          return "";
        }

        return (
          word.charAt(0).toUpperCase() +
          word.slice(1)
        );
      })
      .join(" ");
  }

  function cleanVariantValue(value) {
    var result = clean(value);

    result = result
      .replace(/^select\s+/i, "")
      .replace(/^choose\s+/i, "")
      .replace(/^size\s*:\s*/i, "")
      .replace(/^color\s*:\s*/i, "")
      .replace(/^colour\s*:\s*/i, "")
      .replace(/^style\s*:\s*/i, "")
      .trim();

    if (
      result === "-" ||
      result === "--" ||
      /^select$/i.test(result)
    ) {
      return "";
    }

    if (result.length > 180) {
      return "";
    }

    return result;
  }

  function addVariant(
    output,
    seen,
    label,
    value
  ) {
    var cleanLabel =
      titleCaseDimension(label);

    var cleanValue =
      cleanVariantValue(value);

    if (
      !cleanLabel ||
      !cleanValue
    ) {
      return;
    }

    var key =
      cleanLabel.toLowerCase();

    /*
     * Do not replace a good value with a duplicate/empty fallback.
     */
    if (seen[key]) {
      return;
    }

    seen[key] = true;

    output.push({
      name: cleanLabel,
      value: cleanValue
    });
  }

  function selectedValueFromContainer(
    container
  ) {
    if (!container) {
      return "";
    }

    var selectors = [
      ".selection",
      ".a-dropdown-prompt",
      "[aria-checked='true']",
      "[aria-selected='true']",
      "li.swatchSelect",
      "li.a-active",
      "option:checked",
      "input:checked"
    ];

    for (
      var i = 0;
      i < selectors.length;
      i++
    ) {
      var selected =
        container.querySelector(
          selectors[i]
        );

      if (!selected) {
        continue;
      }

      var value =
        clean(
          selected.getAttribute &&
          (
            selected.getAttribute(
              "aria-label"
            ) ||
            selected.getAttribute(
              "title"
            ) ||
            selected.getAttribute(
              "data-value"
            ) ||
            selected.getAttribute(
              "value"
            )
          )
        ) ||
        clean(
          selected.innerText ||
          selected.textContent ||
          ""
        );

      if (!value) {
        var image =
          selected.querySelector &&
          selected.querySelector(
            "img"
          );

        if (image) {
          value =
            clean(
              image.getAttribute(
                "alt"
              ) ||
              image.getAttribute(
                "title"
              ) ||
              ""
            );
        }
      }

      value =
        cleanVariantValue(value);

      if (value) {
        return value;
      }
    }

    return "";
  }

  function getVariants() {
    var variants = [];
    var seen = {};

    /*
     * Standard Amazon variation blocks:
     *
     * variation_size_name
     * variation_color_name
     * variation_style_name
     * variation_capacity_name
     * variation_configuration
     * etc.
     */
    var variationBlocks =
      document.querySelectorAll(
        "[id^='variation_']"
      );

    for (
      var i = 0;
      i < variationBlocks.length;
      i++
    ) {
      var block =
        variationBlocks[i];

      var blockId =
        clean(
          block.getAttribute("id") ||
          ""
        );

      if (!blockId) {
        continue;
      }

      var value =
        selectedValueFromContainer(
          block
        );

      if (value) {
        addVariant(
          variants,
          seen,
          blockId,
          value
        );
      }
    }

    /*
     * Amazon's newer inline-twister mobile UI.
     *
     * Examples:
     *
     * inline-twister-expanded-dimension-text-size_name
     * inline-twister-expanded-dimension-text-color_name
     */
    var inlineNodes =
      document.querySelectorAll(
        "[id^='inline-twister-expanded-dimension-text-']"
      );

    for (
      var j = 0;
      j < inlineNodes.length;
      j++
    ) {
      var inlineNode =
        inlineNodes[j];

      var inlineId =
        clean(
          inlineNode.getAttribute(
            "id"
          ) || ""
        );

      var dimension =
        inlineId.replace(
          /^inline-twister-expanded-dimension-text-/i,
          ""
        );

      var inlineValue =
        cleanVariantValue(
          inlineNode.innerText ||
          inlineNode.textContent ||
          ""
        );

      if (inlineValue) {
        addVariant(
          variants,
          seen,
          dimension,
          inlineValue
        );
      }
    }

    /*
     * Explicit checked/selected variation controls.
     *
     * This handles Amazon layouts where the selected value lives
     * on an ARIA control instead of a traditional variation block.
     */
    var selectedControls =
      document.querySelectorAll(
        "[aria-checked='true'], [aria-selected='true']"
      );

    for (
      var k = 0;
      k < selectedControls.length;
      k++
    ) {
      var control =
        selectedControls[k];

      var current =
        control;

      var dimensionName = "";
      var depth = 0;

      while (
        current &&
        current !== document.body &&
        depth < 6
      ) {
        var id =
          clean(
            current.getAttribute &&
            current.getAttribute("id")
          );

        if (
          id &&
          (
            id.indexOf("variation_") === 0 ||
            id.indexOf(
              "inline-twister"
            ) >= 0
          )
        ) {
          dimensionName = id;
          break;
        }

        current =
          current.parentElement;

        depth++;
      }

      if (!dimensionName) {
        continue;
      }

      var controlValue =
        clean(
          control.getAttribute &&
          (
            control.getAttribute(
              "aria-label"
            ) ||
            control.getAttribute(
              "title"
            ) ||
            control.getAttribute(
              "data-value"
            )
          )
        ) ||
        clean(
          control.innerText ||
          control.textContent ||
          ""
        );

      addVariant(
        variants,
        seen,
        dimensionName,
        controlValue
      );
    }

    /*
     * Final compatibility fallbacks for Amazon's most common
     * dimensions.
     */
    var common = [
      {
        name: "Size",
        value:
          text(
            "#variation_size_name .selection"
          ) ||
          text(
            "#variation_size_name .a-dropdown-prompt"
          )
      },
      {
        name: "Color",
        value:
          text(
            "#variation_color_name .selection"
          ) ||
          text(
            "#variation_color_name .a-dropdown-prompt"
          )
      },
      {
        name: "Style",
        value:
          text(
            "#variation_style_name .selection"
          ) ||
          text(
            "#variation_style_name .a-dropdown-prompt"
          )
      },
      {
        name: "Capacity",
        value:
          text(
            "#variation_size_name .selection"
          ) && ""
      }
    ];

    for (
      var n = 0;
      n < common.length;
      n++
    ) {
      if (common[n].value) {
        addVariant(
          variants,
          seen,
          common[n].name,
          common[n].value
        );
      }
    }

    return variants;
  }

  function getVariantValue(
    variants,
    names
  ) {
    for (
      var i = 0;
      i < variants.length;
      i++
    ) {
      var label =
        String(
          variants[i].name || ""
        ).toLowerCase();

      for (
        var j = 0;
        j < names.length;
        j++
      ) {
        if (
          label ===
          names[j].toLowerCase()
        ) {
          return clean(
            variants[i].value
          );
        }
      }
    }

    return "";
  }

  function variantsToOptions(
    variants
  ) {
    var parts = [];

    for (
      var i = 0;
      i < variants.length;
      i++
    ) {
      var name =
        clean(
          variants[i].name
        );

      var value =
        clean(
          variants[i].value
        );

      if (
        !name ||
        !value
      ) {
        continue;
      }

      parts.push(
        name + ": " + value
      );
    }

    return parts.join(" | ");
  }

  function getProductId() {
    var path =
      String(
        location.pathname || ""
      );

    var match =
      path.match(
        /\/dp\/([A-Z0-9]{10})/i
      ) ||
      path.match(
        /\/gp\/product\/([A-Z0-9]{10})/i
      ) ||
      path.match(
        /\/gp\/aw\/d\/([A-Z0-9]{10})/i
      );

    if (
      match &&
      match[1]
    ) {
      return match[1].toUpperCase();
    }

    return "";
  }

  function getCanonicalUrl() {
    var asin = getProductId();

    if (asin) {
      return (
        location.protocol +
        "//" +
        location.hostname +
        "/dp/" +
        asin
      );
    }

    return String(
      location.href || ""
    ).split("#")[0];
  }

  function getStockStatus() {
    if (!isAmazon() || !isProductPage()) {
      return { blocked: false, reason: "not-product" };
    }

    /*
     * Check Amazon's current product availability section.
     * Do not scan the entire page because other colour cards
     * may contain "Currently unavailable".
     */
    var selectors = [
      "#availability",
      "#availabilityInsideBuyBox_feature_div",
      "#outOfStock",
      "#availability_feature_div"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);

      if (!el) continue;

      var availabilityText = clean(
        el.innerText || el.textContent || ""
      );

      if (
        /currently unavailable|out of stock|temporarily out of stock|not available for purchase/i
          .test(availabilityText)
      ) {
        return {
          blocked: true,
          reason: "amazon-current-product-unavailable",
          message:
            "This selection is unavailable or incomplete on Amazon. Please choose an available colour and size."
        };
      }
    }

    return {
      blocked: false,
      reason: "no-unavailability-evidence"
    };
  }
  function scrape() {
    var variants =
      getVariants();

    var size =
      getVariantValue(
        variants,
        [
          "Size"
        ]
      );

    var color =
      getVariantValue(
        variants,
        [
          "Color",
          "Colour"
        ]
      );

    /*
     * AMAZON COLOR TEXT FALLBACK
     *
     * Some Amazon shoe/product layouts do not expose the selected
     * colour through the normal variation/swatch attributes.
     *
     * Example:
     *
     * Colour: SAIL/MIDNIGHT NAVY-GUM LIGHT BROWN
     * Size: 7 UK
     *
     * Only use this fallback when the normal Amazon variant
     * extraction did not already find a colour.
     */
    if (!color) {
      try {
        var amazonBodyText =
          clean(
            document.body
              ? document.body.innerText || ""
              : ""
          );

        var amazonColorMatch =
          amazonBodyText.match(
            /(?:Colour|Color)\s*:\s*(.{1,100}?)(?=\s+(?:Size\s*:|Size guide|MRP\b|\u20B9|Rs\.?|INR\b|Add to|Buy now|$))/i
          );

        if (
          amazonColorMatch &&
          amazonColorMatch[1]
        ) {
          var fallbackColor =
            cleanVariantValue(
              amazonColorMatch[1]
            );

          if (
            fallbackColor &&
            fallbackColor.length <= 100
          ) {
            color = fallbackColor;

            variants.push({
              name: "Color",
              value: fallbackColor
            });
          }
        }
      } catch (err) {}
    }

    return {
      __amazonColorDebug: {
        productPage: isProductPage(),
        selectedVariants: variants,
        selectedSize: size,
        selectedColor: color,
        extractedPrice: getPrice(),
        availability: (function () {
          var selectors = [
            "#availability",
            "#availabilityInsideBuyBox_feature_div",
            "#outOfStock",
            "#availability_feature_div",
            "#desktop_buybox",
            "#buybox"
          ];

          var results = [];

          for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);

            if (!el) continue;

            results.push({
              selector: selectors[i],
              text: clean(
                el.innerText || el.textContent || ""
              ).slice(0, 400)
            });
          }

          return results;
        })()
      },
      stockStatus: getStockStatus(),
      adapter: "amazon",
      store: "Amazon India",
      isProductPage:
        isProductPage(),

      productId:
        getProductId(),

      name:
        getTitle(),

      inr:
        getPrice(),

      image:
        getImage(),

      link:
        getCanonicalUrl(),

      variants:
        variants,

      options:
        variantsToOptions(
          variants
        ),

      size:
        size,

      color:
        color,
    };
  }

  window.__miAmazonAdapter = {
    isAmazon:
      isAmazon,

    isProductPage:
      isProductPage,

    getTitle:
      getTitle,

    getPrice:
      getPrice,

    getImage:
      getImage,

    getVariants:
      getVariants,

    scrape:
      scrape
  };
})();
`;
