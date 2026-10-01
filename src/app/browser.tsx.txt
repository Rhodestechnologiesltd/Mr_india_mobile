// src/app/browser.tsx - the core feature. Opens a real Indian store in a
// WebView and injects a floating "Shop via Mr India" button. Tapping it scrapes
// the product and adds it to the Mr India cart (you pay Mr India, not the store).
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { api, getColors, money, useStore } from "../lib/mrindia";

// JavaScript injected into each store page to extract product details and block store checkout actions.

const INJECTED = `
(function(){

// Prevent the browser helpers and event listeners from being installed more than once.
  if (window.__miInjected) return;
  window.__miInjected = true;
  /*
   * MR INDIA WEBVIEW NAVIGATION FIX
   *
   * Keep new-window navigation inside the current WebView.
   * Ordinary same-window navigation is left alone.
   */

  try {
    var originalWindowOpen = window.open;

    window.open = function(url, target, features) {
      try {
        if (url) {
          var resolvedUrl = String(url);

          try {
            resolvedUrl = new URL(
              resolvedUrl,
              window.location.href
            ).href;
          } catch (err) {}

          if (
            !target ||
            target === "_blank" ||
            target === "_new"
          ) {
            window.location.href = resolvedUrl;
            return window;
          }
        }
      } catch (err) {}

      try {
        return originalWindowOpen.apply(
          window,
          arguments
        );
      } catch (err) {
        return null;
      }
    };
  } catch (err) {}

  /*
   * Also handle normal links that explicitly request
   * another browser window/tab using target="_blank".
   */
  document.addEventListener(
    "click",
    function(e) {
      try {
        var el = e.target;

        while (
          el &&
          el !== document.body &&
          String(el.tagName || "").toLowerCase() !== "a"
        ) {
          el = el.parentElement;
        }

        if (!el) {
          return;
        }

        if (
          String(el.tagName || "").toLowerCase() !== "a"
        ) {
          return;
        }

        var target = String(
          (el.getAttribute &&
            el.getAttribute("target")) ||
          ""
        ).toLowerCase();

        /*
         * Ordinary same-window links continue normally.
         */
        if (
          target !== "_blank" &&
          target !== "_new"
        ) {
          return;
        }

        var href =
          (el.getAttribute &&
            el.getAttribute("href")) ||
          el.href ||
          "";

        if (!href) {
          return;
        }

        if (
          String(href)
            .toLowerCase()
            .indexOf("javascript:") === 0
        ) {
          return;
        }

        var resolvedHref = String(href);

        try {
          resolvedHref = new URL(
            resolvedHref,
            window.location.href
          ).href;
        } catch (err) {}

        e.preventDefault();

        /*
         * Intentionally do NOT call stopPropagation().
         *
         * The existing Mr India cart/login blocker must still
         * receive this click in capture phase.
         */
        window.location.href = resolvedHref;
      } catch (err) {}
    },
    true
  );

  // Read Open Graph or standard metadata from the current store page.
  function meta(p){
    var el =
      document.querySelector('meta[property="'+p+'"]') ||
      document.querySelector('meta[name="'+p+'"]');

    return el ? (el.getAttribute('content') || '').trim() : '';
  }

  function cleanBasic(t){
    return (t || "")
      .replace(/\\s+/g, " ")
      .trim();
  }

  function cleanClickText(t){
    return (t || "")
      .replace(/\\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function txt(sel){
    var el = document.querySelector(sel);
    if(!el) return "";
    return cleanBasic(el.innerText || el.textContent || "");
  }

  function attr(sel, at){
    var el = document.querySelector(sel);
    if(!el) return "";
    return (el.getAttribute(at) || "").trim();
  }

  // Identify the supported store from the current hostname.
  function store(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("myntra") >= 0) return "Myntra";
    if(h.indexOf("flipkart") >= 0) return "Flipkart";
    if(h.indexOf("amazon") >= 0) return "Amazon India";
    if(h.indexOf("ajio") >= 0) return "AJIO";
    if(h.indexOf("nykaa") >= 0) return "Nykaa";
    if(h.indexOf("meesho") >= 0) return "Meesho";
    if(h.indexOf("boat") >= 0) return "boAt";
    if(h.indexOf("jockey") >= 0) return "Jockey";
    if(h.indexOf("firstcry") >= 0) return "FirstCry";
    if(h.indexOf("ikea") >= 0) return "IKEA";

    return "Indian Store";
  }

  function cleanTitle(t){
    if(!t) return "";

    t = cleanBasic(t);

    t = t.replace(/^Amazon\\.in\\s*:\\s*/i, "");
    t = t.replace(/\\s*:\\s*Amazon\\.in.*$/i, "");
    t = t.replace(/\\s*\\|\\s*.*$/i, "");
    t = t.replace(/\\s*-\\s*Buy.*$/i, "");
    t = t.replace(/\\s*-\\s*Online.*$/i, "");

    var low = t.toLowerCase();

    var bad = [
      "product summary presents key product information",
      "product information",
      "added to cart",
      "shopping cart",
      "online shopping",
      "sign in",
      "buy now",
      "go to cart",
      "go to bag",
      "add to cart",
      "add to bag",
      "checkout",
      "secure transaction",
      "customer reviews"
    ];

    for(var i = 0; i < bad.length; i++){
      if(low.indexOf(bad[i]) >= 0){
        return "";
      }
    }

    if(t.length < 4) return "";
    if(t.length > 180) t = t.substring(0,180);

    return t;
  }

  function firstGoodTitle(list){
    for(var i = 0; i < list.length; i++){
      var t = cleanTitle(list[i]);
      if(t) return t;
    }

    return "";
  }

   // Find the most reliable product title using store-specific selectors and metadata fallbacks.
  function bestTitle(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("amazon") >= 0){
      var amazonTitle = firstGoodTitle([
        txt("#productTitle"),
        txt("#title span"),
        txt("#title"),
        txt("[data-feature-name='title'] h1"),
        txt("h1.a-size-large"),
        meta("og:title"),
        meta("twitter:title")
      ]);

      if(amazonTitle) return amazonTitle;
    }

    if(h.indexOf("flipkart") >= 0){
      var flipTitle = firstGoodTitle([
        txt("span.B_NuCI"),
        txt(".VU-ZEz"),
        txt(".yhB1nd"),
        txt("h1"),
        meta("og:title"),
        meta("twitter:title")
      ]);

      if(flipTitle) return flipTitle;
    }

    if(h.indexOf("myntra") >= 0){
      var brand = txt(".pdp-title");
      var name = txt(".pdp-name");

      var myntraTitle = cleanTitle((brand + " " + name).trim());
      if(myntraTitle) return myntraTitle;

      myntraTitle = firstGoodTitle([
        txt("h1"),
        meta("og:title"),
        meta("twitter:title"),
        document.title
      ]);

      if(myntraTitle) return myntraTitle;
    }

    if(h.indexOf("firstcry") >= 0){
      var firstTitle = firstGoodTitle([
        txt(".prod-name"),
        txt(".p-name"),
        txt("h1"),
        meta("og:title"),
        meta("twitter:title"),
        document.title
      ]);

      if(firstTitle) return firstTitle;
    }

    if(h.indexOf("jockey") >= 0){
      var jockeyTitle = firstGoodTitle([
        txt("h1"),
        txt("[class*='product-title']"),
        txt("[class*='ProductTitle']"),
        meta("og:title"),
        meta("twitter:title"),
        document.title
      ]);

      if(jockeyTitle) return jockeyTitle;
    }

    if(h.indexOf("ikea") >= 0){
      var ikeaName =
        txt("[data-testid='product-name']") ||
        txt(".pip-header-section__title--big") ||
        txt("h1");

      var ikeaDesc =
        txt("[data-testid='product-type']") ||
        txt(".pip-header-section__description-text") ||
        "";

      var ikeaTitle = cleanTitle((ikeaName + " " + ikeaDesc).trim());

      if(ikeaTitle) return ikeaTitle;

      ikeaTitle = firstGoodTitle([
        meta("og:title"),
        meta("twitter:title"),
        document.title
      ]);

      if(ikeaTitle) return ikeaTitle;
    }

    if(h.indexOf("boat") >= 0){
      var boatTitle = firstGoodTitle([
        txt("h1"),
        txt("[class*='product-title']"),
        txt("[class*='ProductTitle']"),
        meta("og:title"),
        meta("twitter:title"),
        document.title
      ]);

      if(boatTitle) return boatTitle;
    }

    if(h.indexOf("nykaa") >= 0){
      var nykaaTitle = firstGoodTitle([
        txt("h1"),
        txt("[class*='product-title']"),
        txt("[class*='ProductTitle']"),
        meta("og:title"),
        meta("twitter:title"),
        document.title
      ]);

      if(nykaaTitle) return nykaaTitle;
    }

    var generalTitle = firstGoodTitle([
      txt("h1"),
      meta("og:title"),
      meta("twitter:title"),
      document.title
    ]);

    if(generalTitle) return generalTitle;

    return "Product from " + store();
  }

   // Find the primary product image using store-specific selectors and general metadata.
  function bestImage(){
    var h = location.hostname.toLowerCase();
    var img = "";

    if(h.indexOf("amazon") >= 0){
      img =
        attr("#landingImage", "src") ||
        attr("#imgTagWrapperId img", "src") ||
        attr("[data-old-hires]", "data-old-hires") ||
        meta("og:image");
    }

    if(!img && h.indexOf("flipkart") >= 0){
      img =
        attr("img._396cs4", "src") ||
        attr("img.DByuf4", "src") ||
        attr("img[src*='rukminim']", "src") ||
        meta("og:image");
    }

    if(!img && h.indexOf("myntra") >= 0){
      img =
        attr(".image-grid-image", "src") ||
        attr("img[src*='myntra']", "src") ||
        meta("og:image");
    }

    if(!img && h.indexOf("firstcry") >= 0){
      img =
        attr("img[src*='fcapp']", "src") ||
        attr("img[src*='firstcry']", "src") ||
        meta("og:image");
    }

    if(!img && h.indexOf("jockey") >= 0){
      img =
        attr("img[src*='jockey']", "src") ||
        meta("og:image");
    }

    if(!img && h.indexOf("ikea") >= 0){
      img =
        attr("img[src*='ikea']", "src") ||
        meta("og:image");
    }

    if(!img && h.indexOf("boat") >= 0){
      img =
        attr("img[src*='cdn.shopify']", "src") ||
        attr("img[src*='boat']", "src") ||
        meta("og:image");
    }

    if(!img){
      img = meta("og:image") || meta("twitter:image") || "";
    }

    if(!img){
      var im = document.querySelector("img[src*='http']");
      if(im) img = im.src;
    }

    return img || "";
  }

  function px(tx){
    if(!tx) return 0;

    tx = cleanBasic(tx);

    var m = tx.match(/(?:\u20B9|Rs\\.?|INR)\\s*(\\d{1,3}(?:,\\d{2,3})+|\\d{2,7})(?:\\.\\d{1,2})?/i);
    if(!m) return 0;

    return parseFloat(m[1].replace(/,/g, ""));
  }

  // Search known price elements and fall back to the first rupee value found on the page.
  function structuredProductPrice(){
    try{
      var metaPrice =
        meta("product:price:amount") ||
        meta("og:price:amount");

      if(metaPrice){
        var mv = parseFloat(String(metaPrice).replace(/,/g, ""));
        if(isFinite(mv) && mv > 0) return mv;
      }

      var scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );

      for(var i = 0; i < scripts.length; i++){
        try{
          var data = JSON.parse(
            scripts[i].textContent || scripts[i].innerText || "{}"
          );

          var queue = Array.isArray(data) ? data.slice() : [data];

          while(queue.length){
            var node = queue.shift();

            if(!node || typeof node !== "object") continue;

            if(node.offers){
              var offers = Array.isArray(node.offers)
                ? node.offers
                : [node.offers];

              for(var j = 0; j < offers.length; j++){
                var raw =
                  offers[j] &&
                  (
                    offers[j].price ||
                    offers[j].lowPrice
                  );

                var value = parseFloat(
                  String(raw || "").replace(/,/g, "")
                );

                if(isFinite(value) && value > 0){
                  return value;
                }
              }
            }

            for(var key in node){
              if(!Object.prototype.hasOwnProperty.call(node, key)) continue;

              var child = node[key];

              if(child && typeof child === "object"){
                if(Array.isArray(child)){
                  for(var k = 0; k < child.length; k++){
                    queue.push(child[k]);
                  }
                } else {
                  queue.push(child);
                }
              }
            }
          }
        }catch(err){}
      }
    }catch(err){}

    return 0;
  }

  function firstPriceFromSelectors(selectors){
    for(var i = 0; i < selectors.length; i++){
      var ns = document.querySelectorAll(selectors[i]);

      for(var j = 0; j < ns.length; j++){
        var tx = cleanBasic(
          ns[j].innerText ||
          ns[j].textContent ||
          ""
        );

        var v = px(tx);

        if(v > 0) return v;
      }
    }

    return 0;
  }

  function amazonCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("amazon") < 0){
      return 0;
    }

    /*
     * Amazon updates these price areas when the shopper changes
     * a size, colour, pack, style, capacity, etc.
     *
     * Prefer the live "price to pay" area before any metadata
     * or structured-data fallback.
     */
    var selectors = [
      ".priceToPay .a-offscreen",
      ".priceToPay",
      "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
      "#corePriceDisplay_desktop_feature_div .a-price",
      "#corePrice_feature_div .a-price .a-offscreen",
      "#corePrice_feature_div .a-price",
      "#apex_desktop .a-price .a-offscreen",
      "#apex_desktop .a-price",
      "#tp_price_block_total_price_ww .a-offscreen",
      "#priceblock_dealprice",
      "#priceblock_saleprice",
      "#priceblock_ourprice"
    ];

    for(var i = 0; i < selectors.length; i++){
      var nodes = document.querySelectorAll(selectors[i]);

      for(var j = 0; j < nodes.length; j++){
        var tx = cleanBasic(
          nodes[j].innerText ||
          nodes[j].textContent ||
          ""
        );

        var value = px(tx);

        if(value > 0){
          return value;
        }
      }
    }

    return 0;
  }
  function flipkartElementVisible(el){
    try{
      if(!el) return false;

      var style = window.getComputedStyle
        ? window.getComputedStyle(el)
        : null;

      if(
        style &&
        (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity || 1) === 0
        )
      ){
        return false;
      }

      var rect = el.getBoundingClientRect
        ? el.getBoundingClientRect()
        : null;

      if(!rect){
        return true;
      }

      if(rect.width <= 0 || rect.height <= 0){
        return false;
      }

      /*
       * It must intersect the current viewport.
       * This rejects stale/hidden Flipkart variant nodes.
       */
      var vh =
        window.innerHeight ||
        document.documentElement.clientHeight ||
        0;

      var vw =
        window.innerWidth ||
        document.documentElement.clientWidth ||
        0;

      if(rect.bottom < 0 || rect.top > vh){
        return false;
      }

      if(rect.right < 0 || rect.left > vw){
        return false;
      }

      return true;
    }catch(err){
      return false;
    }
  }

  function flipkartPurchaseBarContainsCart(el){
    var current = el;
    var depth = 0;

    while(current && current !== document.body && depth < 6){
      var tx = cleanClickText(
        current.innerText ||
        current.textContent ||
        ""
      );

      if(
        tx.indexOf("add to cart") >= 0 ||
        tx.indexOf("go to cart") >= 0
      ){
        return true;
      }

      current = current.parentElement;
      depth++;
    }

    return false;
  }

  function flipkartCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("flipkart") < 0){
      return 0;
    }

    /*
     * FLIPKART PRIMARY STRATEGY
     *
     * Anchor the search to the currently selected size/variant section.
     * Flipkart may keep stale variant DOM nodes elsewhere on the page,
     * so we deliberately do NOT search the entire document first.
     */
    var body = cleanBasic(
      document.body ? document.body.innerText || "" : ""
    );

    var lowerBody = body.toLowerCase();

    var selectedIndex = lowerBody.lastIndexOf("selected size:");

    if(selectedIndex < 0){
      selectedIndex = lowerBody.lastIndexOf("selected size");
    }

    if(selectedIndex >= 0){
      /*
       * Only inspect a limited section after the active selected-size label.
       */
      var productSection = body.substring(
        selectedIndex,
        Math.min(body.length, selectedIndex + 1800)
      );

      var productSectionLower = productSection.toLowerCase();

      /*
       * Stop before promotional/bank-offer areas.
       *
       * We want:
       * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,899  ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹691
       *
       * NOT:
       * Buy at ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹591
       */
      var cutPoints = [
        productSectionLower.indexOf("apply offers"),
        productSectionLower.indexOf("bank offers"),
        productSectionLower.indexOf("delivery details"),
        productSectionLower.indexOf("buy at")
      ];

      var cut = -1;

      for(var c = 0; c < cutPoints.length; c++){
        if(
          cutPoints[c] > 0 &&
          (
            cut < 0 ||
            cutPoints[c] < cut
          )
        ){
          cut = cutPoints[c];
        }
      }

      if(cut > 0){
        productSection = productSection.substring(0, cut);
      }

      /*
       * Collect every rupee value in this CURRENT product section.
       *
       * Typical:
       * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,899
       * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹691
       *
       * The last one before the offer section is the selling price.
       */
      var matches = productSection.match(
        /\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/g
      );

      if(matches && matches.length){
        for(var m = matches.length - 1; m >= 0; m--){
          var raw = matches[m]
            .replace(/[^0-9.,]/g, "")
            .replace(/,/g, "");

          var currentPrice = parseFloat(raw);

          if(
            isFinite(currentPrice) &&
            currentPrice > 0
          ){
            return currentPrice;
          }
        }
      }
    }

    /*
     * FALLBACK 1:
     * visible Flipkart selling-price nodes.
     */
    var selectors = [
      ".Nx9bqj",
      "._30jeq3",
      "._16Jk6d",
      "[class*='Nx9bqj']"
    ];

    for(var s = 0; s < selectors.length; s++){
      var nodes = document.querySelectorAll(selectors[s]);

      for(var j = 0; j < nodes.length; j++){
        var node = nodes[j];

        var valueText = cleanBasic(
          node.innerText ||
          node.textContent ||
          ""
        );

        var value = px(valueText);

        if(value > 0){
          return value;
        }
      }
    }

    /*
     * FALLBACK 2:
     * structured product data.
     *
     * Only use this after live page extraction fails because
     * structured data can represent the default variant.
     */
    return 0;
  }
  function myntraCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("myntra") < 0){
      return 0;
    }

    var body = cleanBasic(
      document.body ? document.body.innerText || "" : ""
    );

    /*
     * MYNTRA CURRENT PRODUCT PRICE
     *
     * Anchor ourselves to the CURRENT Size section first.
     * Then search backwards for the nearest product MRP block.
     *
     * This avoids stale prices elsewhere in Myntra's DOM.
     */
    var lowerBody = body.toLowerCase();

    var sizeIndex = lowerBody.lastIndexOf("size:");

    if(sizeIndex < 0){
      sizeIndex = lowerBody.lastIndexOf("select size");
    }

    if(sizeIndex >= 0){
      var beforeSize = body.substring(
        0,
        sizeIndex
      );

      var upperBeforeSize = beforeSize.toUpperCase();

      /*
       * The nearest MRP before the selected Size belongs to
       * the active product currently being viewed.
       */
      var mrpIndex = upperBeforeSize.lastIndexOf("MRP");

      if(mrpIndex >= 0){
        var priceArea = beforeSize.substring(
          mrpIndex,
          Math.min(beforeSize.length, mrpIndex + 220)
        );

        /*
         * Layout A:
         *
         * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹2,499 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹746 70% OFF
         *
         * use ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹746.
         */
        var discountedMatch = priceArea.match(
          /MRP\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
        );

        if(
          discountedMatch &&
          discountedMatch[2]
        ){
          var sellingPrice = parseFloat(
            discountedMatch[2].replace(/,/g, "")
          );

          if(
            isFinite(sellingPrice) &&
            sellingPrice > 0
          ){
            return sellingPrice;
          }
        }

        /*
         * Layout B:
         *
         * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹589
         *
         * There is no separate discounted selling price.
         * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹589 is therefore the normal product price.
         */
        var singleMrpMatch = priceArea.match(
          /MRP\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
        );

        if(
          singleMrpMatch &&
          singleMrpMatch[1]
        ){
          var normalPrice = parseFloat(
            singleMrpMatch[1].replace(/,/g, "")
          );

          if(
            isFinite(normalPrice) &&
            normalPrice > 0
          ){
            return normalPrice;
          }
        }
      }
    }

    /*
     * FALLBACK
     *
     * Use only Myntra's dedicated product price selectors.
     * Never intentionally use:
     *
     * Get at
     * savings
     * coupons
     * bank offers
     */
    var selectors = [
      ".pdp-discountedPrice",
      ".pdp-price strong",
      ".pdp-price"
    ];

    for(var i = 0; i < selectors.length; i++){
      var nodes = document.querySelectorAll(selectors[i]);

      for(var j = 0; j < nodes.length; j++){
        var tx = cleanBasic(
          nodes[j].innerText ||
          nodes[j].textContent ||
          ""
        );

        if(!tx){
          continue;
        }

        var low = tx.toLowerCase();

        if(
          low.indexOf("get at") >= 0 ||
          low.indexOf("savings") >= 0 ||
          low.indexOf("coupon") >= 0 ||
          low.indexOf("bank offer") >= 0
        ){
          continue;
        }

        var pair = tx.match(
          /MRP\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
        );

        if(pair && pair[1]){
          var pairPrice = parseFloat(
            pair[1].replace(/,/g, "")
          );

          if(isFinite(pairPrice) && pairPrice > 0){
            return pairPrice;
          }
        }

        var single = tx.match(
          /\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/
        );

        if(single && single[1]){
          var value = parseFloat(
            single[1].replace(/,/g, "")
          );

          if(isFinite(value) && value > 0){
            return value;
          }
        }
      }
    }

    return 0;
  }
  function ajioCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("ajio") < 0){
      return 0;
    }

    var body = cleanBasic(
      document.body
        ? document.body.innerText || ""
        : ""
    );

    /*
     * AJIO PRODUCT PRICE
     *
     * Typical live product page:
     *
     * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹14,999 MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹19,999 25% off
     *
     * or
     *
     * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹8,999 MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹11,999
     *
     * The first price is the actual selling price.
     */

    var mainPrice = body.match(
      /\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s*MRP\\s*:?\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/i
    );

    if(mainPrice && mainPrice[1]){
      var directPrice = parseFloat(
        mainPrice[1].replace(/,/g, "")
      );

      if(
        isFinite(directPrice) &&
        directPrice > 0
      ){
        return directPrice;
      }
    }

    /*
     * Some AJIO builds insert text between the current price and MRP.
     */
    var flexiblePrice = body.match(
      /\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?).{0,80}?MRP\\s*:?\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/i
    );

    if(flexiblePrice && flexiblePrice[1]){
      var flexibleValue = parseFloat(
        flexiblePrice[1].replace(/,/g, "")
      );

      if(
        isFinite(flexibleValue) &&
        flexibleValue > 0
      ){
        return flexibleValue;
      }
    }

    /*
     * Dedicated AJIO selling-price elements.
     */
    var selectors = [
      ".prod-sp",
      ".prod-price",
      ".price-current",
      ".current-price",
      "[class*='prod-sp']",
      "[class*='selling-price']",
      "[class*='sellingPrice']",
      "[class*='SellingPrice']",
      "[class*='sale-price']",
      "[class*='SalePrice']",
      "[class*='current-price']",
      "[class*='currentPrice']",
      "[class*='product-price']",
      "[class*='ProductPrice']"
    ];

    for(var i = 0; i < selectors.length; i++){
      var nodes = document.querySelectorAll(
        selectors[i]
      );

      for(var j = 0; j < nodes.length; j++){
        var tx = cleanBasic(
          nodes[j].innerText ||
          nodes[j].textContent ||
          ""
        );

        if(
          !tx ||
          tx.length > 120
        ){
          continue;
        }

        var low = tx.toLowerCase();

        if(
          low.indexOf("coupon") >= 0 ||
          low.indexOf("cashback") >= 0 ||
          low.indexOf("bank offer") >= 0 ||
          low.indexOf("emi") >= 0 ||
          low.indexOf("get it for") >= 0
        ){
          continue;
        }

        var value = px(tx);

        if(value > 0){
          return value;
        }
      }
    }

    return 0;
  }
  function nykaaCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("nykaa") < 0){
      return 0;
    }

    /*
     * NYKAA CURRENT VARIANT PRICE
     *
     * Priority:
     * 1. selected variant with its own price
     * 2. current product selling-price section
     * 3. visible body MRP/selling-price relationship
     *
     * Never deliberately use coupon/savings/offer prices.
     */

    var selectedSelectors = [
      "[aria-selected='true']",
      "[aria-checked='true']",
      "[class*='selected']",
      "[class*='Selected']"
    ];

    for(var s = 0; s < selectedSelectors.length; s++){
      var selectedNodes = document.querySelectorAll(
        selectedSelectors[s]
      );

      for(var n = 0; n < selectedNodes.length; n++){
        var selectedText = cleanBasic(
          selectedNodes[n].innerText ||
          selectedNodes[n].textContent ||
          ""
        );

        if(!selectedText || selectedText.length > 100){
          continue;
        }

        var selectedLow = selectedText.toLowerCase();

        if(
          selectedLow.indexOf("saving") >= 0 ||
          selectedLow.indexOf("coupon") >= 0 ||
          selectedLow.indexOf("offer") >= 0 ||
          selectedLow.indexOf("discount") >= 0
        ){
          continue;
        }

        var selectedPrice = px(selectedText);

        if(selectedPrice > 0){
          return selectedPrice;
        }
      }
    }

    /*
     * Main Nykaa product price areas.
     */
    var selectors = [
      "[data-testid*='price']",
      "[class*='selling-price']",
      "[class*='SellingPrice']",
      "[class*='product-price']",
      "[class*='ProductPrice']",
      "[class*='final-price']",
      "[class*='FinalPrice']",
      "[class*='price']"
    ];

    for(var i = 0; i < selectors.length; i++){
      var nodes = document.querySelectorAll(selectors[i]);

      for(var j = 0; j < nodes.length; j++){
        var tx = cleanBasic(
          nodes[j].innerText ||
          nodes[j].textContent ||
          ""
        );

        if(!tx || tx.length > 140){
          continue;
        }

        var low = tx.toLowerCase();

        /*
         * Layout:
         * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹999 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹749
         */
        var mrpFirst = tx.match(
          /MRP\\s*:?\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
        );

        if(mrpFirst && mrpFirst[1]){
          var priceAfterMrp = parseFloat(
            mrpFirst[1].replace(/,/g, "")
          );

          if(isFinite(priceAfterMrp) && priceAfterMrp > 0){
            return priceAfterMrp;
          }
        }

        /*
         * Layout:
         * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹749 MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹999
         */
        var priceFirst = tx.match(
          /\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?).{0,40}MRP\\s*:?\\s*\\u20B9/i
        );

        if(priceFirst && priceFirst[1]){
          var priceBeforeMrp = parseFloat(
            priceFirst[1].replace(/,/g, "")
          );

          if(isFinite(priceBeforeMrp) && priceBeforeMrp > 0){
            return priceBeforeMrp;
          }
        }

        if(
          low.indexOf("mrp") >= 0 ||
          low.indexOf("saving") >= 0 ||
          low.indexOf("coupon") >= 0 ||
          low.indexOf("offer") >= 0 ||
          low.indexOf("discount") >= 0
        ){
          continue;
        }

        var value = px(tx);

        if(value > 0){
          return value;
        }
      }
    }

    /*
     * Final Nykaa text fallback.
     */
    var body = cleanBasic(
      document.body ? document.body.innerText || "" : ""
    );

    var bodyMrpFirst = body.match(
      /MRP\\s*:?\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
    );

    if(bodyMrpFirst && bodyMrpFirst[1]){
      var bodySelling = parseFloat(
        bodyMrpFirst[1].replace(/,/g, "")
      );

      if(isFinite(bodySelling) && bodySelling > 0){
        return bodySelling;
      }
    }

    return 0;
  }
  function ikeaCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("ikea") < 0){
      return 0;
    }

    /*
     * IKEA LIVE PRODUCT PRICE
     *
     * IKEA generally updates the main product-price component
     * whenever the shopper changes a valid variant.
     *
     * Prefer those live DOM elements over structured metadata.
     */
    var selectors = [
      "[data-testid='product-price']",
      "[data-testid*='product-price']",
      "[data-testid*='price']",
      ".pip-price",
      ".pip-price__integer",
      ".pip-temp-price",
      ".pip-temp-price__integer",
      "[class*='pip-price']",
      "[class*='product-price']",
      "[class*='ProductPrice']"
    ];

    for(var i = 0; i < selectors.length; i++){
      var nodes = document.querySelectorAll(
        selectors[i]
      );

      for(var j = 0; j < nodes.length; j++){
        var tx = cleanBasic(
          nodes[j].innerText ||
          nodes[j].textContent ||
          ""
        );

        if(
          !tx ||
          tx.length > 140
        ){
          continue;
        }

        var low = tx.toLowerCase();

        /*
         * Ignore financing/savings/offer text.
         */
        if(
          low.indexOf("emi") >= 0 ||
          low.indexOf("saving") >= 0 ||
          low.indexOf("coupon") >= 0 ||
          low.indexOf("offer") >= 0
        ){
          continue;
        }

        var value = px(tx);

        if(value > 0){
          return value;
        }
      }
    }

    /*
     * Look for the currently selected IKEA variant.
     * Some size/package variants include their own price.
     */
    var selectedSelectors = [
      "[aria-selected='true']",
      "[aria-checked='true']",
      "[data-selected='true']",
      "[class*='selected']"
    ];

    for(var s = 0; s < selectedSelectors.length; s++){
      var selected = document.querySelectorAll(
        selectedSelectors[s]
      );

      for(var n = 0; n < selected.length; n++){
        var selectedText = cleanBasic(
          selected[n].innerText ||
          selected[n].textContent ||
          ""
        );

        if(
          !selectedText ||
          selectedText.length > 100
        ){
          continue;
        }

        var selectedPrice = px(
          selectedText
        );

        if(selectedPrice > 0){
          return selectedPrice;
        }
      }
    }

    /*
     * IKEA text fallback.
     *
     * Search immediately before the store purchase action,
     * which is usually close to the active product price.
     */
    var body = cleanBasic(
      document.body
        ? document.body.innerText || ""
        : ""
    );

    var lower = body.toLowerCase();

    var purchaseIndex = lower.lastIndexOf(
      "add to bag"
    );

    if(purchaseIndex < 0){
      purchaseIndex = lower.lastIndexOf(
        "add to shopping bag"
      );
    }

    if(purchaseIndex < 0){
      purchaseIndex = lower.lastIndexOf(
        "add to cart"
      );
    }

    if(purchaseIndex >= 0){
      var productArea = body.substring(
        Math.max(0, purchaseIndex - 700),
        purchaseIndex
      );

      var prices = productArea.match(
        /\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/g
      );

      if(prices && prices.length){
        for(var p = prices.length - 1; p >= 0; p--){
          var parsed = parseFloat(
            prices[p]
              .replace(/[^0-9.,]/g, "")
              .replace(/,/g, "")
          );

          if(
            isFinite(parsed) &&
            parsed > 0
          ){
            return parsed;
          }
        }
      }
    }

    return 0;
  }
  function firstCryCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("firstcry") < 0){
      return 0;
    }

    var body = cleanBasic(
      document.body
        ? document.body.innerText || ""
        : ""
    );

    var lower = body.toLowerCase();

    /*
     * FIRSTCRY CURRENT PRODUCT / VARIANT PRICE
     *
     * First try to anchor around the currently selected size.
     */
    var sizeIndex = lower.lastIndexOf("select size");

    if(sizeIndex < 0){
      sizeIndex = lower.lastIndexOf("size:");
    }

    if(sizeIndex < 0){
      sizeIndex = lower.lastIndexOf("choose size");
    }

    if(sizeIndex >= 0){
      var sizeArea = body.substring(
        Math.max(0, sizeIndex - 700),
        Math.min(body.length, sizeIndex + 500)
      );

      /*
       * Layout:
       *
       * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,499 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹899
       */
      var mrpPair = sizeArea.match(
        /MRP\\s*:?\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
      );

      if(mrpPair && mrpPair[1]){
        var pairPrice = parseFloat(
          mrpPair[1].replace(/,/g, "")
        );

        if(
          isFinite(pairPrice) &&
          pairPrice > 0
        ){
          return pairPrice;
        }
      }

      /*
       * Layout:
       *
       * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹899 MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,499
       */
      var sellingFirst = sizeArea.match(
        /\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?).{0,80}?MRP\\s*:?\\s*\\u20B9/i
      );

      if(sellingFirst && sellingFirst[1]){
        var firstPrice = parseFloat(
          sellingFirst[1].replace(/,/g, "")
        );

        if(
          isFinite(firstPrice) &&
          firstPrice > 0
        ){
          return firstPrice;
        }
      }
    }

    /*
     * Main FirstCry price selectors.
     */
    var selectors = [
      ".prod-price",
      ".price",
      "[class*='selling-price']",
      "[class*='SellingPrice']",
      "[class*='sale-price']",
      "[class*='SalePrice']",
      "[class*='final-price']",
      "[class*='FinalPrice']",
      "[class*='product-price']",
      "[class*='ProductPrice']"
    ];

    for(var i = 0; i < selectors.length; i++){
      var nodes = document.querySelectorAll(
        selectors[i]
      );

      for(var j = 0; j < nodes.length; j++){
        var tx = cleanBasic(
          nodes[j].innerText ||
          nodes[j].textContent ||
          ""
        );

        if(
          !tx ||
          tx.length > 140
        ){
          continue;
        }

        var low = tx.toLowerCase();

        if(
          low.indexOf("coupon") >= 0 ||
          low.indexOf("offer") >= 0 ||
          low.indexOf("cashback") >= 0 ||
          low.indexOf("saving") >= 0
        ){
          continue;
        }

        var pair = tx.match(
          /MRP\\s*:?\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
        );

        if(pair && pair[1]){
          var selling = parseFloat(
            pair[1].replace(/,/g, "")
          );

          if(
            isFinite(selling) &&
            selling > 0
          ){
            return selling;
          }
        }

        var value = px(tx);

        if(value > 0){
          return value;
        }
      }
    }

    /*
     * Final FirstCry fallback:
     * inspect prices immediately before the purchase controls.
     */
    var purchaseIndex = lower.lastIndexOf(
      "add to cart"
    );

    if(purchaseIndex < 0){
      purchaseIndex = lower.lastIndexOf(
        "buy now"
      );
    }

    if(purchaseIndex < 0){
      purchaseIndex = lower.lastIndexOf(
        "add to bag"
      );
    }

    if(purchaseIndex >= 0){
      var beforePurchase = body.substring(
        Math.max(0, purchaseIndex - 800),
        purchaseIndex
      );

      var values = beforePurchase.match(
        /\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/g
      );

      if(values && values.length){
        for(var k = values.length - 1; k >= 0; k--){
          var finalValue = parseFloat(
            values[k]
              .replace(/[^0-9.,]/g, "")
              .replace(/,/g, "")
          );

          if(
            isFinite(finalValue) &&
            finalValue > 0
          ){
            return finalValue;
          }
        }
      }
    }

    return 0;
  }
  function jockeyCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("jockey") < 0){
      return 0;
    }

    var body = cleanBasic(
      document.body
        ? document.body.innerText || ""
        : ""
    );

    var lower = body.toLowerCase();

    /*
     * JOCKEY CURRENT VARIANT PRICE
     *
     * Prefer the currently selected size/variant area.
     * The goal is to avoid stale/default prices when another
     * size or colour has been selected.
     */
    var sizeIndex = lower.lastIndexOf("size:");

    if(sizeIndex < 0){
      sizeIndex = lower.lastIndexOf("select size");
    }

    if(sizeIndex < 0){
      sizeIndex = lower.lastIndexOf("choose size");
    }

    if(sizeIndex >= 0){
      /*
       * Search a limited area around the active size section.
       */
      var beforeSize = body.substring(
        Math.max(0, sizeIndex - 700),
        sizeIndex + 250
      );

      /*
       * Layout:
       * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,299
       * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹899
       *
       * or:
       * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,299 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹899
       */
      var prices = beforeSize.match(
        /\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/g
      );

      if(prices && prices.length){
        /*
         * The selling price is normally the final relevant price
         * closest to the active size area.
         */
        for(var p = prices.length - 1; p >= 0; p--){
          var parsed = parseFloat(
            prices[p]
              .replace(/[^0-9.,]/g, "")
              .replace(/,/g, "")
          );

          if(
            isFinite(parsed) &&
            parsed > 0
          ){
            return parsed;
          }
        }
      }
    }

    /*
     * Dedicated Jockey price selectors.
     */
    var selectors = [
      "[class*='sale-price']",
      "[class*='SalePrice']",
      "[class*='selling-price']",
      "[class*='SellingPrice']",
      "[class*='final-price']",
      "[class*='FinalPrice']",
      "[class*='product-price']",
      "[class*='ProductPrice']",
      "[data-testid*='price']"
    ];

    for(var i = 0; i < selectors.length; i++){
      var nodes = document.querySelectorAll(
        selectors[i]
      );

      for(var j = 0; j < nodes.length; j++){
        var tx = cleanBasic(
          nodes[j].innerText ||
          nodes[j].textContent ||
          ""
        );

        if(!tx || tx.length > 120){
          continue;
        }

        var low = tx.toLowerCase();

        /*
         * Do not use coupon/offer/bank values.
         */
        if(
          low.indexOf("coupon") >= 0 ||
          low.indexOf("offer") >= 0 ||
          low.indexOf("cashback") >= 0 ||
          low.indexOf("bank") >= 0 ||
          low.indexOf("saving") >= 0
        ){
          continue;
        }

        /*
         * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1299 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹899
         */
        var pair = tx.match(
          /MRP\\s*:?\\s*\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/i
        );

        if(pair && pair[1]){
          var selling = parseFloat(
            pair[1].replace(/,/g, "")
          );

          if(
            isFinite(selling) &&
            selling > 0
          ){
            return selling;
          }
        }

        var value = px(tx);

        if(value > 0){
          return value;
        }
      }
    }

    /*
     * Final Jockey fallback:
     * use the last sensible rupee amount before Add to Cart/Bag.
     */
    var purchaseIndex = lower.lastIndexOf(
      "add to cart"
    );

    if(purchaseIndex < 0){
      purchaseIndex = lower.lastIndexOf(
        "add to bag"
      );
    }

    if(purchaseIndex >= 0){
      var nearby = body.substring(
        Math.max(0, purchaseIndex - 700),
        purchaseIndex
      );

      var nearbyPrices = nearby.match(
        /\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/g
      );

      if(nearbyPrices && nearbyPrices.length){
        var candidate = nearbyPrices[
          nearbyPrices.length - 1
        ];

        var finalPrice = parseFloat(
          candidate
            .replace(/[^0-9.,]/g, "")
            .replace(/,/g, "")
        );

        if(
          isFinite(finalPrice) &&
          finalPrice > 0
        ){
          return finalPrice;
        }
      }
    }

    return 0;
  }
  function boatCurrentPrice(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("boat") < 0){
      return 0;
    }

    var body = cleanBasic(
      document.body
        ? document.body.innerText || ""
        : ""
    );

    var lower = body.toLowerCase();

    /*
     * Anchor to the ACTIVE boAt variant area:
     *
     * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,399 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹8,499.00 84% Off
     * Choose your color : Dark Blue
     */
    var chooseIndex = lower.lastIndexOf(
      "choose your color"
    );

    if(chooseIndex < 0){
      chooseIndex = lower.lastIndexOf(
        "choose your colour"
      );
    }

    if(chooseIndex >= 0){
      var beforeChoose = body.substring(
        Math.max(0, chooseIndex - 350),
        chooseIndex
      );

      /*
       * IMPORTANT:
       * This code lives inside the INJECTED template string,
       * therefore regex backslashes must be doubled here.
       */
      var amounts = beforeChoose.match(
        /\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/g
      );

      if(amounts && amounts.length){
        /*
         * Work backwards because the active selling price is
         * nearest to "Choose your color".
         */
        for(var i = amounts.length - 1; i >= 0; i--){
          var value = parseFloat(
            amounts[i]
              .replace(/[^0-9.,]/g, "")
              .replace(/,/g, "")
          );

          if(
            isFinite(value) &&
            value > 0
          ){
            /*
             * If the final amount is a crossed-out MRP and we have
             * another nearby value, choose the smaller of the final
             * two amounts.
             */
            if(i > 0){
              var previous = parseFloat(
                amounts[i - 1]
                  .replace(/[^0-9.,]/g, "")
                  .replace(/,/g, "")
              );

              if(
                isFinite(previous) &&
                previous > 0
              ){
                return Math.min(previous, value);
              }
            }

            return value;
          }
        }
      }
    }

    /*
     * Fallback: find a visible boAt price pair anywhere on the
     * current product page.
     */
    var pricePair = body.match(
      /\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s*\\u20B9\\s*([\\d,]+(?:\\.\\d{1,2})?)/
    );

    if(pricePair && pricePair[1] && pricePair[2]){
      var first = parseFloat(
        pricePair[1].replace(/,/g, "")
      );

      var second = parseFloat(
        pricePair[2].replace(/,/g, "")
      );

      if(
        isFinite(first) &&
        first > 0 &&
        isFinite(second) &&
        second > 0
      ){
        return Math.min(first, second);
      }
    }

    return 0;
  }
  function bestPrice(){
    var h = location.hostname.toLowerCase();
    /*
     * AJIO
     *
     * Always use the current visible AJIO product/variant price
     * before structured/default product data.
     */
    if(h.indexOf("ajio") >= 0){
      var ajioLivePrice = ajioCurrentPrice();

      if(ajioLivePrice > 0){
        return ajioLivePrice;
      }
    }

    /*
     * IKEA
     *
     * Prefer the active IKEA product/variant price over
     * structured/default product data.
     */
    if(h.indexOf("ikea") >= 0){
      var ikeaLivePrice = ikeaCurrentPrice();

      if(ikeaLivePrice > 0){
        return ikeaLivePrice;
      }
    }

    /*
     * FIRSTCRY
     *
     * Current live price wins over structured/default data.
     */
    if(h.indexOf("firstcry") >= 0){
      var firstCryLivePrice = firstCryCurrentPrice();

      if(firstCryLivePrice > 0){
        return firstCryLivePrice;
      }
    }

    /*
     * JOCKEY
     *
     * Current selected variant wins over structured/default data.
     */
    if(h.indexOf("jockey") >= 0){
      var jockeyLivePrice = jockeyCurrentPrice();

      if(jockeyLivePrice > 0){
        return jockeyLivePrice;
      }
    }

    /*
     * BOAT
     *
     * Current selected variant wins over structured/default data.
     */
    if(h.indexOf("boat") >= 0){
      return boatCurrentPrice();
    }

    /*
     * NYKAA
     *
     * Current selected variant must win over structured/default data.
     */
    if(h.indexOf("nykaa") >= 0){
      var nykaaLivePrice = nykaaCurrentPrice();

      if(nykaaLivePrice > 0){
        return nykaaLivePrice;
      }
    }

    /*
     * MYNTRA
     *
     * Live page price must win over structured/default product data.
     */
    if(h.indexOf("myntra") >= 0){
      var myntraLivePrice = myntraCurrentPrice();

      if(myntraLivePrice > 0){
        return myntraLivePrice;
      }
    }


    /*
     * FLIPKART
     *
     * Prefer the currently selected variant's live normal selling price.
     * Structured metadata can remain on the default/previous variant.
     */
    if(h.indexOf("flipkart") >= 0){
      var flipkartLivePrice = flipkartCurrentPrice();

      if(flipkartLivePrice > 0){
        return flipkartLivePrice;
      }
    }

    /*
     * AMAZON
     *
     * Always prefer the live selected-variant price.
     * Structured data may represent the default variant instead.
     */
    if(h.indexOf("amazon") >= 0){
      var amazonPrice = amazonCurrentPrice();

      if(amazonPrice > 0){
        return amazonPrice;
      }
    }

    /*
     * Prefer structured product data where the store exposes it.
     * This usually represents the actual selling price rather than
     * crossed-out MRP values or unrelated promotional amounts.
     */
    var structured = structuredProductPrice();

    if(structured > 0){
      return structured;
    }

    /*
     * MYNTRA
     *
     * Prefer the main product selling-price area.
     * Avoid "Get at" / bank-offer amounts and MRP.
     */
    if(h.indexOf("myntra") >= 0){
      var myntraPrice = firstPriceFromSelectors([
        ".pdp-discountedPrice",
        ".pdp-price strong",
        ".pdp-price",
        "[class*='pdp-price']",
        "[class*='discountedPrice']"
      ]);

      if(myntraPrice > 0){
        return myntraPrice;
      }

      var myntraBody = cleanBasic(
        document.body ? document.body.innerText || "" : ""
      );

      /*
       * Typical Myntra text:
       * MRP ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹1,899 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹733 61% OFF
       *
       * Capture the selling price after the MRP.
       */
      var myntraMatch = myntraBody.match(
        /MRP\s*\u20B9\s*[\d,]+(?:\.\d{1,2})?\s*\u20B9\s*(\d[\d,]*(?:\.\d{1,2})?)/i
      );

      if(myntraMatch && myntraMatch[1]){
        return parseFloat(
          myntraMatch[1].replace(/,/g, "")
        );
      }
    }

    /*
     * FLIPKART
     *
     * Prefer Flipkart's current selling-price elements.
     * Do not deliberately use "Buy at" promotional prices.
     */
    if(h.indexOf("flipkart") >= 0){
      var flipkartPrice = firstPriceFromSelectors([
        ".Nx9bqj",
        "._30jeq3",
        "._16Jk6d",
        "[class*='Nx9bqj']"
      ]);

      if(flipkartPrice > 0){
        return flipkartPrice;
      }

      var flipBody = cleanBasic(
        document.body ? document.body.innerText || "" : ""
      );

      /*
       * Common visible form:
       * 7% ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹599 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹558
       *
       * Capture the current price after the MRP.
       */
      var flipMatch = flipBody.match(
        /\u20B9\s*[\d,]+(?:\.\d{1,2})?\s*\u20B9\s*(\d[\d,]*(?:\.\d{1,2})?)/
      );

      if(flipMatch && flipMatch[1]){
        return parseFloat(
          flipMatch[1].replace(/,/g, "")
        );
      }
    }

    /*
     * AMAZON + remaining stores.
     */
    var genericPrice = firstPriceFromSelectors([
      ".a-price .a-offscreen",
      "#corePriceDisplay_desktop_feature_div .a-offscreen",
      "#corePrice_feature_div .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      "#priceblock_saleprice",

      ".prod-price",
      "[data-testid*='price']",
      "[class*='SellingPrice']",
      "[class*='selling-price']"
    ]);

    if(genericPrice > 0){
      return genericPrice;
    }

    /*
     * Last-resort fallback only.
     */
    var body = document.body
      ? document.body.innerText || ""
      : "";

    var bm = body.match(
      /(?:\u20B9|Rs\\.?|INR)\\s*(\\d{1,3}(?:,\\d{2,3})+|\\d{2,7})(?:\\.\\d{1,2})?/i
    );

    if(bm){
      return parseFloat(
        bm[1].replace(/,/g, "")
      );
    }

    return 0;
  }
  function getSelectedSizeFromText(){
    var body = document.body ? cleanBasic(document.body.innerText || "") : "";

    var m =
      body.match(/Size\\s*:\\s*([A-Za-z0-9\\- ]{1,20})/i) ||
      body.match(/Selected\\s*Size\\s*[:\\-]?\\s*([A-Za-z0-9\\- ]{1,20})/i);

    if(m && m[1]){
      var s = cleanBasic(m[1]);

      s = s.replace(/GARMENT.*$/i, "");
      s = s.replace(/Size Chart.*$/i, "");
      s = cleanBasic(s);

      if(s && s.length <= 20) return s;
    }

    return "";
  }

  function getSelectedColorFromText(){
    var body = document.body ? cleanBasic(document.body.innerText || "") : "";

    var m =
      body.match(/Colour\\s*[:]?\\s*([A-Za-z ]{2,30})/i) ||
      body.match(/Color\\s*[:]?\\s*([A-Za-z ]{2,30})/i) ||
      body.match(/Choose colour\\s*[:]?\\s*([A-Za-z ]{2,30})/i) ||
      body.match(/Choose color\\s*[:]?\\s*([A-Za-z ]{2,30})/i);

    if(m && m[1]){
      var c = cleanBasic(m[1]);

      c = c.replace(/Select Size.*$/i, "");
      c = c.replace(/Size.*$/i, "");
      c = cleanBasic(c);

      if(c && c.length <= 30) return c;
    }

    return "";
  }

  // Collect the size and color currently selected by the shopper.
  function bestOptions(){
    var opt = "";
    var h = location.hostname.toLowerCase();

    var size = "";
    var color = "";

    /*
     * AMAZON
     *
     * Read the active variation directly from Amazon's own
     * variation controls before using generic page-text fallbacks.
     */
    if(h.indexOf("amazon") >= 0){
      size =
        txt("#variation_size_name .selection") ||
        txt("#variation_size_name .a-dropdown-prompt") ||
        txt("#inline-twister-expanded-dimension-text-size_name") ||
        txt("[id*='variation_size'] .selection") ||
        "";

      color =
        txt("#variation_color_name .selection") ||
        txt("#variation_color_name .a-dropdown-prompt") ||
        txt("#inline-twister-expanded-dimension-text-color_name") ||
        txt("[id*='variation_color'] .selection") ||
        "";

      /*
       * Amazon selected swatches sometimes expose the value
       * through image alt/title attributes instead of visible text.
       */
      if(!color){
        color =
          attr("#variation_color_name li.swatchSelect img", "alt") ||
          attr("#variation_color_name li.swatchSelect img", "title") ||
          attr("[id*='variation_color'] [aria-checked='true']", "aria-label") ||
          "";
      }

      if(!size){
        size =
          attr("[id*='variation_size'] [aria-checked='true']", "aria-label") ||
          "";
      }
    }

    /*
     * FLIPKART
     *
     * Read the active selected size/color before generic fallbacks.
     */
    if(h.indexOf("flipkart") >= 0){

      if(!size){
        size =
          txt("[class*='selected'][class*='size']") ||
          txt("[class*='size'][aria-selected='true']") ||
          txt("[class*='size'][aria-checked='true']") ||
          txt("._1UcWw6._2tDhp2") ||
          "";
      }

      if(!size){
        var flipBody = document.body
          ? cleanBasic(document.body.innerText || "")
          : "";

        var flipSizeMatch =
          flipBody.match(/Selected\\s*Size\\s*:?\\s*([A-Za-z0-9\\-]{1,20})/i) ||
          flipBody.match(/Size\\s*:?\\s*([A-Za-z0-9\\-]{1,20})\\s*(?:Size Chart|Seller|Delivery|$)/i);

        if(flipSizeMatch && flipSizeMatch[1]){
          size = cleanBasic(flipSizeMatch[1]);
        }
      }

      if(!color){
        color =
          txt("[class*='selected'][class*='color']") ||
          txt("[class*='selected'][class*='colour']") ||
          attr("[aria-checked='true'][class*='color']", "aria-label") ||
          attr("[aria-selected='true'][class*='color']", "aria-label") ||
          "";
      }

      if(!color){
        var flipBodyColor = document.body
          ? cleanBasic(document.body.innerText || "")
          : "";

        var flipColorMatch =
          flipBodyColor.match(
            /Selected\\s*Color\\s*:?\\s*([A-Za-z0-9 \\-]+?)(?=\\s+Selected\\s*Size|\\s+Size\\s*Chart|\\s+Seller|\\s+Delivery|$)/i
          ) ||
          flipBodyColor.match(
            /Selected\\s*Colour\\s*:?\\s*([A-Za-z0-9 \\-]+?)(?=\\s+Selected\\s*Size|\\s+Size\\s*Chart|\\s+Seller|\\s+Delivery|$)/i
          ) ||
          flipBodyColor.match(
            /Color\\s*:?\\s*([A-Za-z0-9 \\-]+?)(?=\\s+Selected\\s*Size|\\s+Size\\s*Chart|\\s+Seller|\\s+Delivery|$)/i
          ) ||
          flipBodyColor.match(
            /Colour\\s*:?\\s*([A-Za-z0-9 \\-]+?)(?=\\s+Selected\\s*Size|\\s+Size\\s*Chart|\\s+Seller|\\s+Delivery|$)/i
          );

        if(flipColorMatch && flipColorMatch[1]){
          color = cleanBasic(flipColorMatch[1]);

          color = color
            .replace(/\\s*Selected\\s*Size.*$/i, "")
            .replace(/\\s*Size\\s*Chart.*$/i, "")
            .trim();
        }
      }
    }
    /*
     * MYNTRA
     *
     * Read the active size/color before generic fallbacks.
     */
    if(h.indexOf("myntra") >= 0){

      if(!size){
        size =
          txt(".size-buttons-size-button-selected") ||
          txt("[class*='size'][class*='selected']") ||
          txt("[class*='Size'][class*='selected']") ||
          attr("[aria-checked='true'][class*='size']", "aria-label") ||
          "";
      }

      var myntraBody = document.body
        ? cleanBasic(document.body.innerText || "")
        : "";

      if(!size){
        var myntraSizeMatch =
          myntraBody.match(
            /Size\\s*:\\s*([A-Za-z0-9 \\-]+?)(?=\\s*\\(|\\s+Size\\s*Chart|\\s+BODY\\s*:|\\s+Type\\s*:|$)/i
          ) ||
          myntraBody.match(
            /Selected\\s*Size\\s*:?\\s*([A-Za-z0-9 \\-]+?)(?=\\s*\\(|\\s+Size\\s*Chart|\\s+BODY\\s*:|$)/i
          );

        if(myntraSizeMatch && myntraSizeMatch[1]){
          size = cleanBasic(myntraSizeMatch[1]);
        }
      }

      if(!color){
        color =
          txt(".pdp-colorSelected") ||
          txt("[class*='colorSelected']") ||
          txt("[class*='colourSelected']") ||
          txt("[class*='color'][class*='selected']") ||
          txt("[class*='colour'][class*='selected']") ||
          attr("[aria-checked='true'][class*='color']", "aria-label") ||
          attr("[aria-selected='true'][class*='color']", "aria-label") ||
          "";
      }

      if(!color){
        var myntraColorMatch =
          myntraBody.match(
            /Color\\s*:?\\s*([A-Za-z0-9 \\-]+?)(?=\\s+Type\\s*:|\\s+Size\\s*:|\\s+Size\\s*Chart|\\s+BODY\\s*:|\\s+Product\\s+Details|$)/i
          ) ||
          myntraBody.match(
            /Colour\\s*:?\\s*([A-Za-z0-9 \\-]+?)(?=\\s+Type\\s*:|\\s+Size\\s*:|\\s+Size\\s*Chart|\\s+BODY\\s*:|\\s+Product\\s+Details|$)/i
          );

        if(myntraColorMatch && myntraColorMatch[1]){
          color = cleanBasic(myntraColorMatch[1]);
        }
      }

      if(color){
        color = color
          .replace(/\\s+Type\\s*:?.*$/i, "")
          .replace(/\\s+Size\\s*:?.*$/i, "")
          .trim();
      }

      if(size){
        size = size
          .replace(/\\s*\\(.*$/i, "")
          .replace(/\\s+Size\\s*Chart.*$/i, "")
          .trim();
      }
    }
    /*
     * NYKAA SELECTED VARIANT EXTRACTION
     *
     * Nykaa variant buttons can contain text such as:
     *
     * 300ml
     * ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹170
     * (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹0.6/ml)
     *
     * The selected option is visually highlighted with Nykaa's
     * pink border. Read the individual visible option cards and
     * choose only the one showing selected-state evidence.
     */
    if(h.indexOf("nykaa") >= 0){

      function nykaaVisible(el){
        try{
          if(!el){
            return false;
          }

          var style = window.getComputedStyle
            ? window.getComputedStyle(el)
            : null;

          if(
            style &&
            (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number(style.opacity || 1) === 0
            )
          ){
            return false;
          }

          var rect = el.getBoundingClientRect
            ? el.getBoundingClientRect()
            : null;

          if(!rect){
            return true;
          }

          return (
            rect.width > 0 &&
            rect.height > 0
          );
        }catch(err){
          return false;
        }
      }

      function nykaaPink(value){
        try{
          var v = String(value || "").toLowerCase();

          if(!v){
            return false;
          }

          if(
            v.indexOf("#e80071") >= 0 ||
            v.indexOf("#fc2779") >= 0 ||
            v.indexOf("#d50066") >= 0
          ){
            return true;
          }

          var m = v.match(
            /rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/
          );

          if(!m){
            return false;
          }

          var r = parseInt(m[1], 10);
          var g = parseInt(m[2], 10);
          var b = parseInt(m[3], 10);

          return (
            r >= 170 &&
            g <= 120 &&
            b >= 70
          );
        }catch(err){
          return false;
        }
      }

      function nykaaSizeValue(raw){
        raw = String(raw || "");

        /*
         * Use the first visible line from the option card.
         *
         * Avoid /\\r?\\n/ here because this code itself lives
         * inside the outer INJECTED template string.
         */
        var lines = raw.split(
          String.fromCharCode(10)
        );

        var first = "";

        for(var li = 0; li < lines.length; li++){
          var candidate = cleanBasic(
            String(lines[li] || "")
              .replace(
                String.fromCharCode(13),
                ""
              )
          );

          if(candidate){
            first = candidate;
            break;
          }
        }

        /*
         * Typical Nykaa variants:
         *
         * 300ml
         * 825ml
         * 50 g
         * 1 kg
         * XL
         * Free Size
         * 7
         */
        if(
          /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|FREE|FREE SIZE|ONE SIZE)$/i
            .test(first)
        ){
          return first;
        }

        if(
          /^\\d+(?:\\.\\d+)?\\s*(?:ML|L|G|GM|GMS|KG|MG|OZ)$/i
            .test(first)
        ){
          return first;
        }

        if(
          /^\\d{1,3}(?:\\.\\d+)?$/
            .test(first)
        ){
          return first;
        }

        return "";
      }

      /*
       * SIZE / VOLUME / WEIGHT
       */
      if(!size){
        var nykaaNodes = document.querySelectorAll(
          "button, [role='button'], [role='radio'], li, label, div"
        );

        var bestNykaaSize = "";
        var bestNykaaScore = -1;

        for(var ni = 0; ni < nykaaNodes.length; ni++){
          var node = nykaaNodes[ni];

          if(!nykaaVisible(node)){
            continue;
          }

          var value = nykaaSizeValue(
            node.innerText ||
            node.textContent ||
            ""
          );

          if(!value){
            continue;
          }

          var score = 0;

          var ariaSelected = cleanClickText(
            (node.getAttribute &&
              node.getAttribute("aria-selected")) || ""
          );

          var ariaChecked = cleanClickText(
            (node.getAttribute &&
              node.getAttribute("aria-checked")) || ""
          );

          var dataSelected = cleanClickText(
            (node.getAttribute &&
              node.getAttribute("data-selected")) || ""
          );

          var dataActive = cleanClickText(
            (node.getAttribute &&
              node.getAttribute("data-active")) || ""
          );

          var cls = cleanClickText(
            (node.getAttribute &&
              node.getAttribute("class")) || ""
          );

          if(ariaSelected === "true"){
            score += 150;
          }

          if(ariaChecked === "true"){
            score += 150;
          }

          if(dataSelected === "true"){
            score += 140;
          }

          if(dataActive === "true"){
            score += 130;
          }

          if(
            cls.indexOf("selected") >= 0 ||
            cls.indexOf("active") >= 0 ||
            cls.indexOf("checked") >= 0
          ){
            score += 100;
          }

          /*
           * Selected Nykaa size in your current mobile page is
           * shown with a pink/magenta border.
           */
          try{
            var style = window.getComputedStyle
              ? window.getComputedStyle(node)
              : null;

            if(style){
              if(
                nykaaPink(style.borderTopColor) ||
                nykaaPink(style.borderRightColor) ||
                nykaaPink(style.borderBottomColor) ||
                nykaaPink(style.borderLeftColor)
              ){
                score += 120;
              }

              if(nykaaPink(style.backgroundColor)){
                score += 40;
              }
            }
          }catch(err){}

          /*
           * Sometimes the option text sits inside the actual
           * selected card, so also inspect two ancestors.
           */
          var parent = node.parentElement;
          var depth = 0;

          while(
            parent &&
            parent !== document.body &&
            depth < 2
          ){
            var parentClass = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("class")) || ""
            );

            var parentSelected = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("aria-selected")) || ""
            );

            var parentChecked = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("aria-checked")) || ""
            );

            var parentDataSelected = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("data-selected")) || ""
            );

            if(
              parentSelected === "true" ||
              parentChecked === "true" ||
              parentDataSelected === "true"
            ){
              score += 120;
            }

            if(
              parentClass.indexOf("selected") >= 0 ||
              parentClass.indexOf("active") >= 0 ||
              parentClass.indexOf("checked") >= 0
            ){
              score += 80;
            }

            try{
              var ps = window.getComputedStyle
                ? window.getComputedStyle(parent)
                : null;

              if(
                ps &&
                (
                  nykaaPink(ps.borderTopColor) ||
                  nykaaPink(ps.borderRightColor) ||
                  nykaaPink(ps.borderBottomColor) ||
                  nykaaPink(ps.borderLeftColor)
                )
              ){
                score += 100;
              }
            }catch(err){}

            parent = parent.parentElement;
            depth++;
          }

          /*
           * Do not select an arbitrary available size.
           * There must be actual selected-state evidence.
           */
          if(
            score > 0 &&
            score > bestNykaaScore
          ){
            bestNykaaScore = score;
            bestNykaaSize = value;
          }
        }

        if(bestNykaaSize){
          size = bestNykaaSize;
        }
      }

      /*
       * SHADE / COLOR
       *
       * Nykaa often updates the product title itself when the
       * shopper selects a shade:
       *
       * Play Daze Airy Liquid Blush - Starlaa Rosy Bronze
       *
       * This is more reliable than trying to infer the selected
       * shade from Nykaa's dynamically generated swatch classes.
       */
      if(!color){

        var nykaaBody = document.body
          ? cleanBasic(
              document.body.innerText || ""
            )
          : "";

        var nykaaBodyLower =
          nykaaBody.toLowerCase();

        var isNykaaShadeProduct =
          nykaaBodyLower.indexOf("select shade") >= 0 ||
          nykaaBodyLower.indexOf("all shades") >= 0 ||
          nykaaBodyLower.indexOf("shade finder") >= 0;

        /*
         * First try explicit selected shade controls in case
         * Nykaa exposes usable accessibility state.
         */
        var nykaaShadeSelectors = [
          "[aria-selected='true'][class*='shade']",
          "[aria-checked='true'][class*='shade']",
          "[data-selected='true'][class*='shade']",
          "[class*='shade'][class*='selected']",
          "[class*='Shade'][class*='selected']",
          "[aria-selected='true'][class*='color']",
          "[aria-checked='true'][class*='color']",
          "[data-selected='true'][class*='color']",
          "[class*='color'][class*='selected']",
          "[class*='Color'][class*='selected']"
        ];

        for(
          var nci = 0;
          nci < nykaaShadeSelectors.length;
          nci++
        ){
          var shadeNodes = document.querySelectorAll(
            nykaaShadeSelectors[nci]
          );

          for(
            var ncj = 0;
            ncj < shadeNodes.length;
            ncj++
          ){
            var shadeNode = shadeNodes[ncj];

            var possibleShade =
              cleanBasic(
                (shadeNode.getAttribute &&
                  shadeNode.getAttribute("aria-label")) ||
                ""
              ) ||
              cleanBasic(
                (shadeNode.getAttribute &&
                  shadeNode.getAttribute("title")) ||
                ""
              ) ||
              cleanBasic(
                shadeNode.innerText ||
                shadeNode.textContent ||
                ""
              );

            possibleShade = possibleShade
              .replace(/^Shade\\s*:?\\s*/i, "")
              .replace(/^Color\\s*:?\\s*/i, "")
              .replace(/^Colour\\s*:?\\s*/i, "")
              .trim();

            if(
              possibleShade &&
              possibleShade.length <= 50
            ){
              color = possibleShade;
              break;
            }
          }

          if(color){
            break;
          }
        }

        /*
         * Reliable Nykaa fallback:
         *
         * On shade-based products Nykaa puts the selected shade
         * after " - " in the CURRENT product title.
         */
        if(
          !color &&
          isNykaaShadeProduct
        ){
          var currentNykaaTitle =
            cleanBasic(bestTitle());

          var titleSeparator =
            currentNykaaTitle.lastIndexOf(" - ");

          if(
            titleSeparator >= 0 &&
            titleSeparator <
              currentNykaaTitle.length - 3
          ){
            var shadeFromTitle = cleanBasic(
              currentNykaaTitle.substring(
                titleSeparator + 3
              )
            );

            /*
             * Reject clearly invalid title suffixes.
             */
            var shadeLower =
              shadeFromTitle.toLowerCase();

            if(
              shadeFromTitle &&
              shadeFromTitle.length <= 60 &&
              shadeLower.indexOf("online") < 0 &&
              shadeLower.indexOf("nykaa") < 0 &&
              shadeLower.indexOf("buy") < 0
            ){
              color = shadeFromTitle;
            }
          }
        }
      }
    }
    /*
     * AJIO
     *
     * AJIO puts every available size inside one parent container.
     * Therefore generic selected-size selectors can accidentally
     * return all sizes such as:
     *
     * S M L XL XXL
     *
     * Inspect the individual controls instead and identify the
     * one that is actually selected.
     */
    if(h.indexOf("ajio") >= 0){

      function ajioLooksLikeSize(value){
        value = cleanBasic(value);

        return /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|FREE|ONE SIZE|[0-9]{1,3}(?:\\.[0-9]+)?)$/i
          .test(value);
      }

      function ajioElementVisible(el){
        try{
          if(!el) return false;

          var style = window.getComputedStyle
            ? window.getComputedStyle(el)
            : null;

          if(
            style &&
            (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number(style.opacity || 1) === 0
            )
          ){
            return false;
          }

          var rect = el.getBoundingClientRect
            ? el.getBoundingClientRect()
            : null;

          if(!rect){
            return true;
          }

          return (
            rect.width > 0 &&
            rect.height > 0
          );
        }catch(err){
          return false;
        }
      }

      function ajioColorIsDark(value){
        try{
          if(!value){
            return false;
          }

          var m = String(value).match(
            /rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/
          );

          if(!m){
            return false;
          }

          var r = parseInt(m[1], 10);
          var g = parseInt(m[2], 10);
          var b = parseInt(m[3], 10);

          var brightness =
            (r * 299 + g * 587 + b * 114) / 1000;

          return brightness < 110;
        }catch(err){
          return false;
        }
      }

      /*
       * SIZE
       */
      if(!size){
        var sizeCandidates = document.querySelectorAll(
          "button, [role='button'], li, label, div, span"
        );

        var bestAjioSize = "";
        var bestAjioSizeScore = -1;

        for(var asi = 0; asi < sizeCandidates.length; asi++){
          var sizeEl = sizeCandidates[asi];

          if(!ajioElementVisible(sizeEl)){
            continue;
          }

          var sizeText = cleanBasic(
            sizeEl.innerText ||
            sizeEl.textContent ||
            ""
          );

          /*
           * Individual size:
           * XXL
           *
           * accepted.
           *
           * Parent:
           * S M L XL XXL
           *
           * rejected.
           */
          if(!ajioLooksLikeSize(sizeText)){
            continue;
          }

          var ariaSelected = cleanClickText(
            (sizeEl.getAttribute &&
              sizeEl.getAttribute("aria-selected")) || ""
          );

          var ariaChecked = cleanClickText(
            (sizeEl.getAttribute &&
              sizeEl.getAttribute("aria-checked")) || ""
          );

          var dataSelected = cleanClickText(
            (sizeEl.getAttribute &&
              sizeEl.getAttribute("data-selected")) || ""
          );

          var dataActive = cleanClickText(
            (sizeEl.getAttribute &&
              sizeEl.getAttribute("data-active")) || ""
          );

          var cls = cleanClickText(
            (sizeEl.getAttribute &&
              sizeEl.getAttribute("class")) || ""
          );

          var style = null;

          try{
            style = window.getComputedStyle
              ? window.getComputedStyle(sizeEl)
              : null;
          }catch(err){}

          var score = 0;

          /*
           * Explicit state is strongest.
           */
          if(ariaSelected === "true"){
            score += 100;
          }

          if(ariaChecked === "true"){
            score += 100;
          }

          if(dataSelected === "true"){
            score += 100;
          }

          if(dataActive === "true"){
            score += 90;
          }

          /*
           * Selected/active classes.
           */
          if(
            cls.indexOf("selected") >= 0 ||
            cls.indexOf("active") >= 0 ||
            cls.indexOf("checked") >= 0 ||
            cls.indexOf("chosen") >= 0
          ){
            score += 70;
          }

          /*
           * AJIO displays the active size as a dark button.
           */
          if(
            style &&
            ajioColorIsDark(style.backgroundColor)
          ){
            score += 60;
          }

          /*
           * Sometimes AJIO applies selected styling to a wrapper.
           */
          var parent = sizeEl.parentElement;
          var depth = 0;

          while(parent && depth < 2){
            var parentClass = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("class")) || ""
            );

            var parentSelected = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("aria-selected")) || ""
            );

            var parentChecked = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("aria-checked")) || ""
            );

            var parentDataSelected = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("data-selected")) || ""
            );

            if(
              parentSelected === "true" ||
              parentChecked === "true" ||
              parentDataSelected === "true"
            ){
              score += 80;
            }

            if(
              parentClass.indexOf("selected") >= 0 ||
              parentClass.indexOf("active") >= 0 ||
              parentClass.indexOf("checked") >= 0
            ){
              score += 50;
            }

            try{
              var parentStyle = window.getComputedStyle
                ? window.getComputedStyle(parent)
                : null;

              if(
                parentStyle &&
                ajioColorIsDark(parentStyle.backgroundColor)
              ){
                score += 40;
              }
            }catch(err){}

            parent = parent.parentElement;
            depth++;
          }

          /*
           * Do not choose an arbitrary available size.
           * Require evidence that it is selected.
           */
          if(
            score > bestAjioSizeScore &&
            score > 0
          ){
            bestAjioSizeScore = score;
            bestAjioSize = sizeText;
          }
        }

        if(bestAjioSize){
          size = bestAjioSize;
        }
      }

      /*
       * COLOR
       *
       * Only save a colour when AJIO exposes a genuinely selected
       * colour control.
       */
      if(!color){
        var ajioColorSelectors = [
          "[aria-selected='true'][class*='color']",
          "[aria-selected='true'][class*='colour']",
          "[aria-checked='true'][class*='color']",
          "[aria-checked='true'][class*='colour']",
          "[data-selected='true'][class*='color']",
          "[data-selected='true'][class*='colour']",
          "[class*='color'][class*='selected']",
          "[class*='colour'][class*='selected']",
          "[class*='Color'][class*='selected']",
          "[class*='Colour'][class*='selected']"
        ];

        for(
          var acs = 0;
          acs < ajioColorSelectors.length;
          acs++
        ){
          var colorNodes = document.querySelectorAll(
            ajioColorSelectors[acs]
          );

          for(
            var acn = 0;
            acn < colorNodes.length;
            acn++
          ){
            var colorNode = colorNodes[acn];

            var possibleColor =
              cleanBasic(
                colorNode.innerText ||
                colorNode.textContent ||
                ""
              ) ||
              cleanBasic(
                (colorNode.getAttribute &&
                  colorNode.getAttribute("aria-label")) ||
                ""
              ) ||
              cleanBasic(
                (colorNode.getAttribute &&
                  colorNode.getAttribute("title")) ||
                ""
              ) ||
              cleanBasic(
                (colorNode.getAttribute &&
                  colorNode.getAttribute("alt")) ||
                ""
              );

            possibleColor = possibleColor
              .replace(/^Colour\\s*:?\\s*/i, "")
              .replace(/^Color\\s*:?\\s*/i, "")
              .trim();

            if(
              possibleColor &&
              possibleColor.length <= 30 &&
              !ajioLooksLikeSize(possibleColor)
            ){
              color = possibleColor;
              break;
            }
          }

          if(color){
            break;
          }
        }
      }
    }
    /*
     * MEESHO SELECTED VARIANT EXTRACTION
     *
     * Keep this deliberately simple because it executes inside
     * the injected WebView JavaScript.
     */
    if(h.indexOf("meesho") >= 0){

      function meeshoVariantSize(raw){
        raw = cleanBasic(raw);

        if(!raw){
          return "";
        }

        /*
         * A Meesho size card often looks like:
         *
         * M ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹216
         *
         * Split on spaces and examine the first token only.
         */
        var parts = raw.split(" ");

        if(!parts || !parts.length){
          return "";
        }

        var first = cleanBasic(parts[0]).toUpperCase();

        var validTextSizes = [
          "XXXS",
          "XXS",
          "XS",
          "S",
          "M",
          "L",
          "XL",
          "XXL",
          "XXXL",
          "XXXXL",
          "FREE",
          "ONESIZE"
        ];

        for(var vsi = 0; vsi < validTextSizes.length; vsi++){
          if(first === validTextSizes[vsi]){
            return first === "ONESIZE"
              ? "One Size"
              : first;
          }
        }

        /*
         * Numeric clothing/shoe sizes.
         */
        var numeric = Number(first);

        if(
          first !== "" &&
          isFinite(numeric) &&
          numeric > 0 &&
          numeric <= 100
        ){
          return first;
        }

        return "";
      }

      function meeshoNodeVisible(el){
        try{
          if(!el){
            return false;
          }

          var style = window.getComputedStyle
            ? window.getComputedStyle(el)
            : null;

          if(
            style &&
            (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number(style.opacity || 1) === 0
            )
          ){
            return false;
          }

          var rect = el.getBoundingClientRect
            ? el.getBoundingClientRect()
            : null;

          if(!rect){
            return true;
          }

          return rect.width > 0 && rect.height > 0;
        }catch(err){
          return false;
        }
      }

      function meeshoHasPinkBorder(el){
        try{
          if(!el || !window.getComputedStyle){
            return false;
          }

          var style = window.getComputedStyle(el);

          var values = [
            style.borderTopColor,
            style.borderRightColor,
            style.borderBottomColor,
            style.borderLeftColor,
            style.color,
            style.backgroundColor
          ];

          for(var ci = 0; ci < values.length; ci++){
            var value = String(values[ci] || "")
              .toLowerCase()
              .replace(/\\s+/g, "");

            /*
             * Meesho commonly uses #9f2089 / rgb(159,32,137).
             */
            if(
              value.indexOf("159,32,137") >= 0 ||
              value.indexOf("#9f2089") >= 0 ||
              value.indexOf("163,31,141") >= 0
            ){
              return true;
            }
          }
        }catch(err){}

        return false;
      }

      if(!size){
        var meeshoNodes = document.querySelectorAll(
          "button, [role='button'], [role='radio'], li, label, div, span"
        );

        var meeshoBestSize = "";
        var meeshoBestScore = 0;

        for(var mi = 0; mi < meeshoNodes.length; mi++){
          var meeshoNode = meeshoNodes[mi];

          if(!meeshoNodeVisible(meeshoNode)){
            continue;
          }

          var nodeText = cleanBasic(
            meeshoNode.innerText ||
            meeshoNode.textContent ||
            ""
          );

          if(
            !nodeText ||
            nodeText.length > 35
          ){
            continue;
          }

          var candidateSize = meeshoVariantSize(
            nodeText
          );

          if(!candidateSize){
            continue;
          }

          var score = 0;

          var ariaSelected = cleanClickText(
            (meeshoNode.getAttribute &&
              meeshoNode.getAttribute("aria-selected")) || ""
          );

          var ariaChecked = cleanClickText(
            (meeshoNode.getAttribute &&
              meeshoNode.getAttribute("aria-checked")) || ""
          );

          var dataSelected = cleanClickText(
            (meeshoNode.getAttribute &&
              meeshoNode.getAttribute("data-selected")) || ""
          );

          var cls = cleanClickText(
            (meeshoNode.getAttribute &&
              meeshoNode.getAttribute("class")) || ""
          );

          if(ariaSelected === "true"){
            score += 100;
          }

          if(ariaChecked === "true"){
            score += 100;
          }

          if(dataSelected === "true"){
            score += 100;
          }

          if(
            cls.indexOf("selected") >= 0 ||
            cls.indexOf("active") >= 0 ||
            cls.indexOf("checked") >= 0
          ){
            score += 80;
          }

          if(meeshoHasPinkBorder(meeshoNode)){
            score += 80;
          }

          /*
           * Often the selected styling is on the wrapper.
           */
          var parent = meeshoNode.parentElement;
          var depth = 0;

          while(
            parent &&
            parent !== document.body &&
            depth < 2
          ){
            var parentClass = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("class")) || ""
            );

            var parentSelected = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("aria-selected")) || ""
            );

            var parentChecked = cleanClickText(
              (parent.getAttribute &&
                parent.getAttribute("aria-checked")) || ""
            );

            if(
              parentSelected === "true" ||
              parentChecked === "true"
            ){
              score += 80;
            }

            if(
              parentClass.indexOf("selected") >= 0 ||
              parentClass.indexOf("active") >= 0 ||
              parentClass.indexOf("checked") >= 0
            ){
              score += 60;
            }

            if(meeshoHasPinkBorder(parent)){
              score += 70;
            }

            parent = parent.parentElement;
            depth++;
          }

          if(score > meeshoBestScore){
            meeshoBestScore = score;
            meeshoBestSize = candidateSize;
          }
        }

        if(
          meeshoBestSize &&
          meeshoBestScore > 0
        ){
          size = meeshoBestSize;
        }
      }

      /*
       * Important:
       *
       * Do not use the generic Meesho "Color:" fallback because
       * it previously interpreted product-description text like
       * "White Fabric Rayon Fit" as a selected colour.
       *
       * If Meesho exposes a proper colour selector later, we can
       * add a dedicated colour extractor.
       */
      color = "";
    }
    /*
     * BOAT SELECTED COLOR
     *
     * boAt exposes the current selected colour in page text:
     *
     * Choose your color : Navy Blue
     * Choose your color : Gunmetal Green
     */
    if(h.indexOf("boat") >= 0){

      var boatBody = document.body
        ? cleanBasic(document.body.innerText || "")
        : "";

      var boatColorMatch =
        boatBody.match(
          /Choose your color\\s*:\\s*([A-Za-z0-9 &\\-]+?)(?=\\s+(?:Active Black|Onyx Black|Zinc White|Inclusive of all|Check Delivery|Add To Cart|Buy Now|Ã¢â€šÂ¹))/i
        ) ||
        boatBody.match(
          /Choose your colour\\s*:\\s*([A-Za-z0-9 &\\-]+?)(?=\\s+(?:Active Black|Onyx Black|Zinc White|Inclusive of all|Check Delivery|Add To Cart|Buy Now|Ã¢â€šÂ¹))/i
        );

      if(boatColorMatch && boatColorMatch[1]){
        color = cleanBasic(
          boatColorMatch[1]
        );
      }
    }
    /*
     * JOCKEY SELECTED VARIANTS
     *
     * Jockey highlights the selected size using a dark filled
     * control. The selected colour is normally included at the
     * end of the current product title.
     */
    if(h.indexOf("jockey") >= 0){

      /*
       * SIZE
       */
      if(!size){
        var jockeyNodes = document.querySelectorAll(
          "button, [role='button'], [role='radio'], li, label"
        );

        var jockeyBestSize = "";
        var jockeyBestScore = -1;

        for(var ji = 0; ji < jockeyNodes.length; ji++){
          var jockeyEl = jockeyNodes[ji];

          var jockeyText = cleanBasic(
            jockeyEl.innerText ||
            jockeyEl.textContent ||
            ""
          );

          /*
           * Only actual size-looking values are allowed.
           */
          if(
            !/^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|FREE|FREE SIZE|ONE SIZE|[0-9]{1,3})$/i
              .test(jockeyText)
          ){
            continue;
          }

          var jockeyScore = 0;

          var jockeyAriaSelected = cleanClickText(
            (jockeyEl.getAttribute &&
              jockeyEl.getAttribute("aria-selected")) || ""
          );

          var jockeyAriaChecked = cleanClickText(
            (jockeyEl.getAttribute &&
              jockeyEl.getAttribute("aria-checked")) || ""
          );

          var jockeyDataSelected = cleanClickText(
            (jockeyEl.getAttribute &&
              jockeyEl.getAttribute("data-selected")) || ""
          );

          var jockeyClass = cleanClickText(
            (jockeyEl.getAttribute &&
              jockeyEl.getAttribute("class")) || ""
          );

          if(jockeyAriaSelected === "true"){
            jockeyScore += 150;
          }

          if(jockeyAriaChecked === "true"){
            jockeyScore += 150;
          }

          if(jockeyDataSelected === "true"){
            jockeyScore += 140;
          }

          if(
            jockeyClass.indexOf("selected") >= 0 ||
            jockeyClass.indexOf("active") >= 0 ||
            jockeyClass.indexOf("checked") >= 0
          ){
            jockeyScore += 100;
          }

          /*
           * Current Jockey mobile UI uses a dark background for
           * the selected size.
           */
          try{
            var jockeyStyle = window.getComputedStyle
              ? window.getComputedStyle(jockeyEl)
              : null;

            if(jockeyStyle){
              var jockeyBg = String(
                jockeyStyle.backgroundColor || ""
              );

              var jockeyRgb = jockeyBg.match(
                /rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/
              );

              if(jockeyRgb){
                var jockeyR = parseInt(
                  jockeyRgb[1],
                  10
                );

                var jockeyG = parseInt(
                  jockeyRgb[2],
                  10
                );

                var jockeyB = parseInt(
                  jockeyRgb[3],
                  10
                );

                var jockeyBrightness =
                  (
                    jockeyR * 299 +
                    jockeyG * 587 +
                    jockeyB * 114
                  ) / 1000;

                if(jockeyBrightness < 140){
                  jockeyScore += 130;
                }
              }
            }
          }catch(err){}

          /*
           * Sometimes selected styling is on the wrapper.
           */
          var jockeyParent =
            jockeyEl.parentElement;

          var jockeyDepth = 0;

          while(
            jockeyParent &&
            jockeyParent !== document.body &&
            jockeyDepth < 2
          ){
            var jockeyParentClass =
              cleanClickText(
                (jockeyParent.getAttribute &&
                  jockeyParent.getAttribute("class")) || ""
              );

            var jockeyParentSelected =
              cleanClickText(
                (jockeyParent.getAttribute &&
                  jockeyParent.getAttribute("aria-selected")) || ""
              );

            var jockeyParentChecked =
              cleanClickText(
                (jockeyParent.getAttribute &&
                  jockeyParent.getAttribute("aria-checked")) || ""
              );

            if(
              jockeyParentSelected === "true" ||
              jockeyParentChecked === "true"
            ){
              jockeyScore += 100;
            }

            if(
              jockeyParentClass.indexOf("selected") >= 0 ||
              jockeyParentClass.indexOf("active") >= 0 ||
              jockeyParentClass.indexOf("checked") >= 0
            ){
              jockeyScore += 80;
            }

            try{
              var jockeyParentStyle =
                window.getComputedStyle
                  ? window.getComputedStyle(jockeyParent)
                  : null;

              if(jockeyParentStyle){
                var parentBg = String(
                  jockeyParentStyle.backgroundColor || ""
                );

                var parentRgb = parentBg.match(
                  /rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/
                );

                if(parentRgb){
                  var pr = parseInt(parentRgb[1], 10);
                  var pg = parseInt(parentRgb[2], 10);
                  var pb = parseInt(parentRgb[3], 10);

                  var parentBrightness =
                    (
                      pr * 299 +
                      pg * 587 +
                      pb * 114
                    ) / 1000;

                  if(parentBrightness < 140){
                    jockeyScore += 90;
                  }
                }
              }
            }catch(err){}

            jockeyParent =
              jockeyParent.parentElement;

            jockeyDepth++;
          }

          if(
            jockeyScore > 0 &&
            jockeyScore > jockeyBestScore
          ){
            jockeyBestScore =
              jockeyScore;

            jockeyBestSize =
              jockeyText;
          }
        }

        if(jockeyBestSize){
          size = jockeyBestSize;
        }
      }

      /*
       * COLOR
       *
       * Current Jockey product titles contain the active colour:
       *
       * ... T-Shirt - Plum Truffle
       * ... T-Shirt - Lilac Snow
       * ... Socks - Steel Grey Melange
       */
      if(!color){
        var jockeyCurrentTitle =
          cleanBasic(bestTitle());

        var jockeySeparator =
          jockeyCurrentTitle.lastIndexOf(
            " - "
          );

        if(
          jockeySeparator >= 0 &&
          jockeySeparator <
            jockeyCurrentTitle.length - 3
        ){
          var jockeyTitleColor =
            cleanBasic(
              jockeyCurrentTitle.substring(
                jockeySeparator + 3
              )
            );

          var jockeyTitleColorLower =
            jockeyTitleColor.toLowerCase();

          if(
            jockeyTitleColor &&
            jockeyTitleColor.length <= 50 &&
            jockeyTitleColorLower.indexOf("jockey") < 0 &&
            jockeyTitleColorLower.indexOf("online") < 0 &&
            jockeyTitleColorLower.indexOf("buy") < 0 &&
            jockeyTitleColorLower.indexOf("do not iron") < 0 &&
            jockeyTitleColorLower.indexOf("wash") < 0
          ){
            color = jockeyTitleColor;
          }
        }
      }
    }
    /*
     * Other stores / fallback selectors.
     *
     * AJIO is deliberately excluded because its generic size
     * container contains every available size.
     */
    /*
     * IKEA SELECTED VARIANTS
     *
     * IKEA normally exposes the active colour/material and
     * dimensions directly inside the current product description.
     *
     * Examples:
     *
     * Box with lid, transparent, 39x28x14 cm/11 l
     * Organiser, plastic/beige, 10x20x5 cm
     */
    if(h.indexOf("ikea") >= 0){

      var ikeaOptionDescription =
        txt("[data-testid='product-type']") ||
        txt(".pip-header-section__description-text") ||
        cleanBasic(bestTitle()) ||
        "";

      ikeaOptionDescription =
        cleanBasic(ikeaOptionDescription);

      if(ikeaOptionDescription){

        var ikeaParts =
          ikeaOptionDescription.split(",");

        for(
          var ip = 0;
          ip < ikeaParts.length;
          ip++
        ){
          ikeaParts[ip] =
            cleanBasic(ikeaParts[ip]);
        }

        /*
         * SIZE / DIMENSIONS
         */
        if(!size){

          for(
            var isz = ikeaParts.length - 1;
            isz >= 1;
            isz--
          ){
            var ikeaSizeCandidate =
              cleanBasic(
                ikeaParts[isz]
              );

            if(
              ikeaSizeCandidate &&
              (
                /\\d+\\s*x\\s*\\d+/i.test(
                  ikeaSizeCandidate
                ) ||
                /\\d+\\s*(?:cm|mm|m|l|ml|kg|g)\\b/i.test(
                  ikeaSizeCandidate
                )
              )
            ){
              size =
                ikeaSizeCandidate;

              break;
            }
          }
        }

        /*
         * COLOR
         */
        if(
          !color &&
          ikeaParts.length >= 2
        ){
          var ikeaColorCandidate =
            cleanBasic(
              ikeaParts[1]
            );

          /*
           * Example:
           *
           * plastic/beige
           *
           * becomes:
           *
           * beige
           */
          if(
            ikeaColorCandidate &&
            ikeaColorCandidate.indexOf("/") >= 0
          ){
            var ikeaColorPieces =
              ikeaColorCandidate.split("/");

            ikeaColorCandidate =
              cleanBasic(
                ikeaColorPieces[
                  ikeaColorPieces.length - 1
                ]
              );
          }

          var ikeaColorLower =
            ikeaColorCandidate.toLowerCase();

          if(
            ikeaColorCandidate &&
            ikeaColorCandidate.length <= 40 &&
            !/\\d/.test(ikeaColorCandidate) &&
            ikeaColorLower.indexOf("cm") < 0 &&
            ikeaColorLower.indexOf("mm") < 0 &&
            ikeaColorLower.indexOf("litre") < 0 &&
            ikeaColorLower.indexOf("liter") < 0
          ){
            color =
              ikeaColorCandidate;
          }
        }
      }
    }
    /*
     * FIRSTCRY SELECTED COLOR
     *
     * FirstCry changes the current product title when a colour
     * variant is selected.
     *
     * Examples:
     *
     * Cute Walk by Babyhug Slip On Solid Sneaker Shoes - Beige
     * Cute Walk by Babyhug Slip On Solid Sneaker Shoes - Blue
     *
     * Therefore use the text after the final " - " as the
     * selected FirstCry colour.
     */
    if(h.indexOf("firstcry") >= 0){

      if(!color){

        var firstCryCurrentTitle =
          cleanBasic(bestTitle());

        var firstCrySeparator =
          firstCryCurrentTitle.lastIndexOf(
            " - "
          );

        if(
          firstCrySeparator >= 0 &&
          firstCrySeparator <
            firstCryCurrentTitle.length - 3
        ){
          var firstCryTitleColor =
            cleanBasic(
              firstCryCurrentTitle.substring(
                firstCrySeparator + 3
              )
            );

          var firstCryColorLower =
            firstCryTitleColor.toLowerCase();

          if(
            firstCryTitleColor &&
            firstCryTitleColor.length <= 40 &&
            firstCryColorLower.indexOf("firstcry") < 0 &&
            firstCryColorLower.indexOf("online") < 0 &&
            firstCryColorLower.indexOf("buy") < 0 &&
            firstCryColorLower.indexOf("size") < 0 &&
            firstCryColorLower.indexOf("year") < 0 &&
            firstCryColorLower.indexOf("month") < 0
          ){
            color = firstCryTitleColor;
          }
        }
      }
    }
    if(!size && h.indexOf("ajio") < 0 && h.indexOf("meesho") < 0 && h.indexOf("jockey") < 0 && h.indexOf("ikea") < 0){
      size =
        txt("[class*='size'][class*='selected']") ||
        txt(".size-buttons-selected") ||
        txt("[aria-checked='true'][class*='size']") ||
        getSelectedSizeFromText();
    }

    size = cleanBasic(size);

    if(size){
      size = size.replace(/^Size\\s*:\\s*/i, "");
      size = size.replace(/^Selected\\s*Size\\s*:\\s*/i, "");
      size = cleanBasic(size);
    }

    if(
      size &&
      (
        size.length <= 20 ||
        (
          h.indexOf("ikea") >= 0 &&
          size.length <= 100
        )
      )
    ){
      opt = "Size: " + size;
    }

    if(
      !color &&
      h.indexOf("ajio") < 0 &&
      h.indexOf("meesho") < 0 &&
      h.indexOf("boat") < 0 &&
      h.indexOf("jockey") < 0 &&
      h.indexOf("firstcry") < 0 &&
      h.indexOf("ikea") < 0
    ){
      color =
        txt("[class*='color'][class*='selected']") ||
        txt("[class*='Colour'][class*='selected']") ||
        txt("[aria-checked='true'][class*='color']") ||
        getSelectedColorFromText();
    }

    color = cleanBasic(color);

    if(color){
      color = color.replace(/^Colour\\s*:?\\s*/i, "");
      color = color.replace(/^Color\\s*:?\\s*/i, "");
      color = color.replace(/^Choose colour\\s*:?\\s*/i, "");
      color = color.replace(/^Choose color\\s*:?\\s*/i, "");
      color = cleanBasic(color);
    }

    if(color && color.length <= 30){
      opt = opt ? opt + " - Color: " + color : "Color: " + color;
    }

    return opt;
  }
  // Build the normalized product payload sent back to the React Native application.
  function scrape(){
    var result = {
      name: bestTitle(),
      inr: bestPrice(),
      store: store(),
      link: location.href.split("?")[0],
      image: bestImage(),
      options: bestOptions()
    };

    /*
     * TEMPORARY boAt diagnostic.
     * This reports exactly what the boAt WebView DOM exposes.
     */
    if(location.hostname.toLowerCase().indexOf("boat") >= 0){
      try{
        var bodyText = cleanBasic(
          document.body
            ? document.body.innerText || ""
            : ""
        );

        var lowBody = bodyText.toLowerCase();

        var colorIndex = lowBody.lastIndexOf(
          "choose your color"
        );

        if(colorIndex < 0){
          colorIndex = lowBody.lastIndexOf(
            "choose your colour"
          );
        }

        var snippet = "";

        if(colorIndex >= 0){
          snippet = bodyText.substring(
            Math.max(0, colorIndex - 500),
            Math.min(
              bodyText.length,
              colorIndex + 300
            )
          );
        }

        var candidates = [];

        var elements = document.querySelectorAll(
          "div, span, p, strong, b, h1, h2, h3, h4"
        );

        for(var i = 0; i < elements.length; i++){
          var el = elements[i];

          var valueText = cleanBasic(
            el.innerText ||
            el.textContent ||
            ""
          );

          if(
            !valueText ||
            valueText.length > 140 ||
            valueText.indexOf("\u20B9") < 0
          ){
            continue;
          }

          try{
            var rect = el.getBoundingClientRect();

            var style = window.getComputedStyle
              ? window.getComputedStyle(el)
              : null;

            candidates.push({
              text: valueText,
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              display: style ? style.display : "",
              visibility: style ? style.visibility : "",
              cls: String(
                (el.getAttribute &&
                  el.getAttribute("class")) || ""
              ).substring(0, 180)
            });
          }catch(err){}

          if(candidates.length >= 35){
            break;
          }
        }

        result.__boatDebug = {
          scrapedPrice: result.inr,
          colorIndex: colorIndex,
          snippet: snippet,
          candidates: candidates
        };
      }catch(err){
        result.__boatDebug = {
          error: String(err)
        };
      }
    }

    /*
     * TEMPORARY AJIO PRICE DIAGNOSTIC
     */
    if(location.hostname.toLowerCase().indexOf("ajio") >= 0){
      try{
        var ajioBody = cleanBasic(
          document.body
            ? document.body.innerText || ""
            : ""
        );

        var ajioLower = ajioBody.toLowerCase();

        var ajioAnchor = ajioLower.lastIndexOf("select size");

        if(ajioAnchor < 0){
          ajioAnchor = ajioLower.lastIndexOf("size chart");
        }

        if(ajioAnchor < 0){
          ajioAnchor = ajioLower.lastIndexOf("add to bag");
        }

        if(ajioAnchor < 0){
          ajioAnchor = ajioLower.lastIndexOf("go to bag");
        }

        var ajioSnippet = "";

        if(ajioAnchor >= 0){
          ajioSnippet = ajioBody.substring(
            Math.max(0, ajioAnchor - 1200),
            Math.min(ajioBody.length, ajioAnchor + 500)
          );
        } else {
          ajioSnippet = ajioBody.substring(0, 1800);
        }

        var ajioPrices = ajioSnippet.match(
          /\\u20B9\\s*[\\d,]+(?:\\.\\d{1,2})?/g
        ) || [];

        var ajioPriceNodes = [];

        var allAjioNodes = document.querySelectorAll(
          "div, span, p, strong, b"
        );

        for(var ai = 0; ai < allAjioNodes.length; ai++){
          var nodeText = cleanBasic(
            allAjioNodes[ai].innerText ||
            allAjioNodes[ai].textContent ||
            ""
          );

          if(
            !nodeText ||
            nodeText.length > 180 ||
            nodeText.indexOf("\u20B9") < 0
          ){
            continue;
          }

          ajioPriceNodes.push({
            text: nodeText,
            cls: String(
              (allAjioNodes[ai].getAttribute &&
                allAjioNodes[ai].getAttribute("class")) || ""
            ).substring(0, 180)
          });

          if(ajioPriceNodes.length >= 40){
            break;
          }
        }

        result.__ajioDebug = {
          scrapedPrice: result.inr,
          anchor: ajioAnchor,
          snippet: ajioSnippet,
          prices: ajioPrices,
          priceNodes: ajioPriceNodes,
          optionNodes: ajioOptionNodes
        };
      }catch(err){
        var ajioOptionNodes = [];

        var optionElements = document.querySelectorAll(
          "button, a, div, span, li, input, label, img, [role='button'], [aria-selected], [aria-checked]"
        );

        for(var oi = 0; oi < optionElements.length; oi++){
          var optionEl = optionElements[oi];

          var optionText = cleanBasic(
            optionEl.innerText ||
            optionEl.textContent ||
            ""
          );

          var optionClass = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("class")) || ""
          );

          var optionId = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("id")) || ""
          );

          var optionAria = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("aria-label")) || ""
          );

          var optionTitle = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("title")) || ""
          );

          var optionAlt = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("alt")) || ""
          );

          var optionSelected = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("aria-selected")) || ""
          );

          var optionChecked = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("aria-checked")) || ""
          );

          var optionDataSelected = String(
            (optionEl.getAttribute &&
              optionEl.getAttribute("data-selected")) || ""
          );

          var combinedOption = cleanClickText(
            optionText + " " +
            optionClass + " " +
            optionId + " " +
            optionAria + " " +
            optionTitle + " " +
            optionAlt
          );

          var interesting =
            combinedOption.indexOf("size") >= 0 ||
            combinedOption.indexOf("color") >= 0 ||
            combinedOption.indexOf("colour") >= 0 ||
            combinedOption.indexOf("variant") >= 0 ||
            combinedOption.indexOf("swatch") >= 0 ||
            combinedOption.indexOf("selected") >= 0 ||
            optionSelected === "true" ||
            optionChecked === "true" ||
            optionDataSelected === "true";

          if(!interesting){
            continue;
          }

          if(optionText.length > 180){
            continue;
          }

          ajioOptionNodes.push({
            tag: String(optionEl.tagName || ""),
            text: optionText,
            cls: optionClass.substring(0, 220),
            id: optionId.substring(0, 120),
            aria: optionAria.substring(0, 160),
            title: optionTitle.substring(0, 160),
            alt: optionAlt.substring(0, 160),
            ariaSelected: optionSelected,
            ariaChecked: optionChecked,
            dataSelected: optionDataSelected
          });

          if(ajioOptionNodes.length >= 120){
            break;
          }
        }
        result.__ajioDebug = {
          error: String(err)
        };
      }
    }

    return result;
  }
  // Notify the native layer when a store cart or checkout action is detected.
  function notifyStoreCart(reason){
    try{
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "STORE_CART_DETECTED",
        reason: reason || "store-cart"
      }));
    }catch(e){}
  }

  // Notify the native layer when a store sign-in or registration action is detected.
  function notifyAuthBlocked(reason){
  try{
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "STORE_AUTH_BLOCKED",
      reason: reason || "store-auth-blocked"
    }));
  }catch(e){}
}

  function getVisibleText(el){
    if(!el) return "";

    var tag = (el.tagName || "").toLowerCase();

    if(tag === "input"){
      return cleanClickText((el.getAttribute && el.getAttribute("value")) || "");
    }

    return cleanClickText(el.innerText || el.textContent || "");
  }

  function isQuantityOrVariantText(t){
    t = cleanClickText(t);

    return (
      t === "+" ||
      t === "-" ||
      t === "-" ||
      t === "add" ||
      t === "remove" ||
      t === "increase" ||
      t === "decrease" ||
      t === "xs" ||
      t === "s" ||
      t === "m" ||
      t === "l" ||
      t === "xl" ||
      t === "xxl" ||
      t === "xxxl" ||
      t === "size" ||
      t === "size chart" ||
      t.indexOf("select size") >= 0 ||
      t.indexOf("colour") >= 0 ||
      t.indexOf("color") >= 0 ||
      t.indexOf("choose colour") >= 0 ||
      t.indexOf("choose color") >= 0
    );
  }

  function isStoreAddButtonText(t){
    if(!t) return false;

    t = cleanClickText(t);

    if(isQuantityOrVariantText(t)) return false;

    return (
      t === "add to cart" ||
      t === "add to bag" ||
      t === "add to basket" ||
      t === "add to trolley" ||
      t === "buy now" ||
      t === "buy at" ||
      t === "pay now" ||
      t === "go to cart" ||
      t === "go to bag" ||
      t.indexOf("add to cart") >= 0 ||
      t.indexOf("add to bag") >= 0 ||
      t.indexOf("add to basket") >= 0 ||
      t.indexOf("add to trolley") >= 0 ||
      t.indexOf("buy now") >= 0 ||
      t.indexOf("buy at") >= 0 ||
      t.indexOf("buy with emi") >= 0 ||
      t.indexOf("pay now") >= 0 ||
      t.indexOf("go to cart") >= 0 ||
      t.indexOf("go to bag") >= 0
    );
  }

  function getOwnButtonText(el){
    if(!el) return "";

    var tag = (el.tagName || "").toLowerCase();
    var aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
    var title = (el.getAttribute && el.getAttribute("title")) || "";
    var value = (el.getAttribute && el.getAttribute("value")) || "";
    var id = (el.getAttribute && el.getAttribute("id")) || "";
    var testid = (el.getAttribute && el.getAttribute("data-testid")) || "";
    var cls = (el.getAttribute && el.getAttribute("class")) || "";
    var visible = getVisibleText(el);

    if(visible.length > 70){
      visible = "";
    }

    return cleanClickText(
      aria + " " +
      title + " " +
      value + " " +
      visible + " " +
      id + " " +
      testid + " " +
      cls
    );
  }

  function isInteractiveElement(el){
    if(!el) return false;

    var tag = (el.tagName || "").toLowerCase();
    var role = (el.getAttribute && el.getAttribute("role")) || "";
    var cls = ((el.getAttribute && el.getAttribute("class")) || "").toLowerCase();

    return (
      tag === "button" ||
      tag === "input" ||
      role === "button" ||
      cls.indexOf("button") >= 0 ||
      cls.indexOf("btn") >= 0 ||
      cls.indexOf("add-to-cart") >= 0 ||
      cls.indexOf("addtobag") >= 0 ||
      cls.indexOf("add-to-bag") >= 0
    );
  }

  function isSafeProductNavigation(el){
    var depth = 0;

    while(el && el !== document.body && depth < 5){
      var text = getVisibleText(el);

      if(
        text === "view product" ||
        text.indexOf("view product") >= 0 ||
        text.indexOf("view details") >= 0
      ){
        return true;
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }

function isStoreAuthText(t){
  if(!t) return false;

  t = cleanClickText(t);

  return (
    t === "sign in" ||
    t === "signin" ||
    t === "log in" ||
    t === "login" ||
    t === "sign up" ||
    t === "signup" ||
    t === "register" ||
    t === "create account" ||
    t === "my account" ||
    t === "account" ||
    t === "profile" ||
    t.indexOf("sign in") >= 0 ||
    t.indexOf("signin") >= 0 ||
    t.indexOf("log in") >= 0 ||
    t.indexOf("login") >= 0 ||
    t.indexOf("sign up") >= 0 ||
    t.indexOf("signup") >= 0 ||
    t.indexOf("register") >= 0 ||
    t.indexOf("create account") >= 0 ||
    t.indexOf("my account") >= 0
  );
}

function hasAuthClass(el){
  if(!el) return false;

  var href = ((el.getAttribute && el.getAttribute("href")) || "").toLowerCase();
  var id = ((el.getAttribute && el.getAttribute("id")) || "").toLowerCase();
  var cls = ((el.getAttribute && el.getAttribute("class")) || "").toLowerCase();
  var testid = ((el.getAttribute && el.getAttribute("data-testid")) || "").toLowerCase();
  var aria = ((el.getAttribute && el.getAttribute("aria-label")) || "").toLowerCase();
  var title = ((el.getAttribute && el.getAttribute("title")) || "").toLowerCase();

  var all = href + " " + id + " " + cls + " " + testid + " " + aria + " " + title;

  return (
    all.indexOf("login") >= 0 ||
    all.indexOf("sign-in") >= 0 ||
    all.indexOf("signin") >= 0 ||
    all.indexOf("sign-up") >= 0 ||
    all.indexOf("signup") >= 0 ||
    all.indexOf("register") >= 0 ||
    all.indexOf("account") >= 0 ||
    all.indexOf("customer/account") >= 0 ||
    all.indexOf("auth") >= 0
  );
}

function findAuthButton(el){
  var depth = 0;

  while(el && el !== document.body && depth < 5){
    var tag = (el.tagName || "").toLowerCase();
    var role = ((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
    var type = ((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();

    /*
     * Search controls must always remain usable.
     */
    if(
      type === "search" ||
      role === "search" ||
      role === "searchbox"
    ){
      return false;
    }

    var isClickableAuthCandidate =
      tag === "a" ||
      tag === "button" ||
      tag === "input" ||
      role === "button";

    /*
     * Only inspect actual interactive controls for authentication.
     * Do not classify large header/container ancestors as auth buttons.
     */
    if(isClickableAuthCandidate){
      var visibleText = getVisibleText(el);
      var ownText = getOwnButtonText(el);

      if(
        isStoreAuthText(visibleText) ||
        isStoreAuthText(ownText) ||
        hasAuthClass(el)
      ){
        return true;
      }
    }

    el = el.parentElement;
    depth++;
  }

  return false;
}

// Walk up from the tapped element to detect a store-owned purchase button.
  function isFlipkartPurchaseAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("flipkart") < 0){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 12){
      var text = cleanClickText(
        el.innerText ||
        el.textContent ||
        ""
      );

      var aria = cleanClickText(
        (el.getAttribute && el.getAttribute("aria-label")) || ""
      );

      var title = cleanClickText(
        (el.getAttribute && el.getAttribute("title")) || ""
      );

      var value = cleanClickText(
        (el.getAttribute && el.getAttribute("value")) || ""
      );

      var combined = cleanClickText(
        text + " " +
        aria + " " +
        title + " " +
        value
      );

      if(
        combined === "add to cart" ||
        combined === "go to cart" ||
        combined === "buy now" ||
        combined.indexOf("add to cart") >= 0 ||
        combined.indexOf("go to cart") >= 0 ||
        combined.indexOf("buy now") >= 0 ||
        combined.indexOf("buy at") === 0 ||
        combined.indexOf("buy at \u20b9") >= 0
      ){
        return true;
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }

  function isBoatAuthAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("boat") < 0){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 10){
      var tag = (el.tagName || "").toLowerCase();

      var role = cleanClickText(
        (el.getAttribute && el.getAttribute("role")) || ""
      );

      var type = cleanClickText(
        (el.getAttribute && el.getAttribute("type")) || ""
      );

      /*
       * Never interfere with search.
       */
      if(
        type === "search" ||
        role === "search" ||
        role === "searchbox"
      ){
        return false;
      }

      var href = cleanClickText(
        (el.getAttribute && el.getAttribute("href")) || ""
      );

      var id = cleanClickText(
        (el.getAttribute && el.getAttribute("id")) || ""
      );

      var cls = cleanClickText(
        (el.getAttribute && el.getAttribute("class")) || ""
      );

      var aria = cleanClickText(
        (el.getAttribute && el.getAttribute("aria-label")) || ""
      );

      var title = cleanClickText(
        (el.getAttribute && el.getAttribute("title")) || ""
      );

      var testid = cleanClickText(
        (el.getAttribute && el.getAttribute("data-testid")) || ""
      );

      var visible = getVisibleText(el);

      if(visible.length > 60){
        visible = "";
      }

      var combined = cleanClickText(
        href + " " +
        id + " " +
        cls + " " +
        aria + " " +
        title + " " +
        testid + " " +
        visible
      );

      if(
        combined.indexOf("account") >= 0 ||
        combined.indexOf("profile") >= 0 ||
        combined.indexOf("login") >= 0 ||
        combined.indexOf("log-in") >= 0 ||
        combined.indexOf("signin") >= 0 ||
        combined.indexOf("sign-in") >= 0 ||
        combined.indexOf("customer") >= 0 ||
        combined.indexOf("kwikpass") >= 0 ||
        combined.indexOf("kwik pass") >= 0
      ){
        return true;
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }
  function isAjioPurchaseAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("ajio") < 0){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 12){
      var tag = (el.tagName || "").toLowerCase();

      var role = cleanClickText(
        (el.getAttribute && el.getAttribute("role")) || ""
      );

      var type = cleanClickText(
        (el.getAttribute && el.getAttribute("type")) || ""
      );

      /*
       * Keep AJIO search usable.
       */
      if(
        type === "search" ||
        role === "search" ||
        role === "searchbox"
      ){
        return false;
      }

      var visible = cleanClickText(
        el.innerText ||
        el.textContent ||
        ""
      );

      if(visible.length > 100){
        visible = "";
      }

      var href = cleanClickText(
        (el.getAttribute && el.getAttribute("href")) || ""
      );

      var aria = cleanClickText(
        (el.getAttribute && el.getAttribute("aria-label")) || ""
      );

      var title = cleanClickText(
        (el.getAttribute && el.getAttribute("title")) || ""
      );

      var value = cleanClickText(
        (el.getAttribute && el.getAttribute("value")) || ""
      );

      var id = cleanClickText(
        (el.getAttribute && el.getAttribute("id")) || ""
      );

      var cls = cleanClickText(
        (el.getAttribute && el.getAttribute("class")) || ""
      );

      var testid = cleanClickText(
        (el.getAttribute && el.getAttribute("data-testid")) || ""
      );

      var combined = cleanClickText(
        visible + " " +
        href + " " +
        aria + " " +
        title + " " +
        value + " " +
        id + " " +
        cls + " " +
        testid
      );

      var purchaseAction =
        visible === "add to bag" ||
        visible === "go to bag" ||
        visible === "add to cart" ||
        visible === "go to cart" ||
        visible === "buy now" ||
        visible === "checkout" ||

        combined.indexOf("add to bag") >= 0 ||
        combined.indexOf("add-to-bag") >= 0 ||
        combined.indexOf("addtobag") >= 0 ||

        combined.indexOf("go to bag") >= 0 ||
        combined.indexOf("go-to-bag") >= 0 ||
        combined.indexOf("gotobag") >= 0 ||

        combined.indexOf("add to cart") >= 0 ||
        combined.indexOf("add-to-cart") >= 0 ||
        combined.indexOf("addtocart") >= 0 ||

        combined.indexOf("go to cart") >= 0 ||
        combined.indexOf("go-to-cart") >= 0 ||
        combined.indexOf("gotocart") >= 0 ||

        combined.indexOf("buy now") >= 0 ||
        combined.indexOf("checkout") >= 0;

      if(purchaseAction){
        return true;
      }

      /*
       * AJIO header bag/cart icon.
       */
      var cartDestination =
        href.indexOf("/cart") >= 0 ||
        href.indexOf("/bag") >= 0 ||
        href.indexOf("shoppingbag") >= 0 ||
        href.indexOf("shopping-bag") >= 0;

      var cartControl =
        aria.indexOf("bag") >= 0 ||
        aria.indexOf("cart") >= 0 ||
        title.indexOf("bag") >= 0 ||
        title.indexOf("cart") >= 0 ||
        testid.indexOf("bag") >= 0 ||
        testid.indexOf("cart") >= 0 ||
        id.indexOf("bag") >= 0 ||
        id.indexOf("cart") >= 0;

      if(cartDestination || cartControl){
        return true;
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }
  function isIkeaPurchaseAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("ikea") < 0){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 12){
      var tag = (el.tagName || "").toLowerCase();

      var role = cleanClickText(
        (el.getAttribute && el.getAttribute("role")) || ""
      );

      var type = cleanClickText(
        (el.getAttribute && el.getAttribute("type")) || ""
      );

      /*
       * IKEA search must always remain usable.
       */
      if(
        type === "search" ||
        role === "search" ||
        role === "searchbox"
      ){
        return false;
      }

      var href = cleanClickText(
        (el.getAttribute && el.getAttribute("href")) || ""
      );

      var aria = cleanClickText(
        (el.getAttribute && el.getAttribute("aria-label")) || ""
      );

      var title = cleanClickText(
        (el.getAttribute && el.getAttribute("title")) || ""
      );

      var value = cleanClickText(
        (el.getAttribute && el.getAttribute("value")) || ""
      );

      var id = cleanClickText(
        (el.getAttribute && el.getAttribute("id")) || ""
      );

      var cls = cleanClickText(
        (el.getAttribute && el.getAttribute("class")) || ""
      );

      var testid = cleanClickText(
        (el.getAttribute && el.getAttribute("data-testid")) || ""
      );

      var visible = cleanClickText(
        el.innerText ||
        el.textContent ||
        ""
      );

      /*
       * Avoid classifying a huge page container as a cart action.
       */
      if(visible.length > 90){
        visible = "";
      }

      var combined = cleanClickText(
        visible + " " +
        aria + " " +
        title + " " +
        value + " " +
        id + " " +
        cls + " " +
        testid
      );

      /*
       * IKEA product purchase controls.
       */
      var purchaseAction =
        visible === "add to bag" ||
        visible === "add to shopping bag" ||
        visible === "add to cart" ||
        visible === "buy now" ||
        visible === "checkout" ||
        visible === "continue to checkout" ||
        visible === "go to bag" ||
        visible === "go to cart" ||

        combined.indexOf("add to bag") >= 0 ||
        combined.indexOf("add-to-bag") >= 0 ||
        combined.indexOf("addtobag") >= 0 ||

        combined.indexOf("add to shopping bag") >= 0 ||
        combined.indexOf("add-to-shopping-bag") >= 0 ||

        combined.indexOf("add to cart") >= 0 ||
        combined.indexOf("add-to-cart") >= 0 ||
        combined.indexOf("addtocart") >= 0 ||

        combined.indexOf("buy now") >= 0 ||
        combined.indexOf("continue to checkout") >= 0 ||
        combined.indexOf("checkout") >= 0 ||
        combined.indexOf("go to bag") >= 0 ||
        combined.indexOf("go to cart") >= 0;

      if(purchaseAction){
        return true;
      }

      /*
       * IKEA compact product-card basket buttons.
       *
       * IKEA can label these controls with text such as:
       * "Add GLIS to shopping bag"
       * instead of simply "Add to bag".
       */
      var ikeaInteractive =
        tag === "button" ||
        tag === "a" ||
        tag === "input" ||
        role === "button";

      var ikeaCompactAdd =
        ikeaInteractive &&
        (
          (
            combined.indexOf("add") >= 0 &&
            (
              combined.indexOf("shopping bag") >= 0 ||
              combined.indexOf("shopping cart") >= 0 ||
              combined.indexOf("basket") >= 0 ||
              combined.indexOf("cart") >= 0
            )
          ) ||
          combined.indexOf("add-product") >= 0 ||
          combined.indexOf("addproduct") >= 0
        );

      if(ikeaCompactAdd){
        return true;
      }

      /*
       * IKEA header shopping-bag/cart icon.
       *
       * The icon often has little or no visible text, therefore
       * inspect its destination and accessibility attributes.
       */
      var cartDestination =
        href.indexOf("shoppingcart") >= 0 ||
        href.indexOf("shopping-cart") >= 0 ||
        href.indexOf("shoppingbag") >= 0 ||
        href.indexOf("shopping-bag") >= 0 ||
        href.indexOf("/cart") >= 0 ||
        href.indexOf("/basket") >= 0;

      var cartControl =
        aria === "shopping bag" ||
        aria === "shopping cart" ||
        aria === "cart" ||
        aria.indexOf("shopping bag") >= 0 ||
        aria.indexOf("shopping cart") >= 0 ||

        title === "shopping bag" ||
        title === "shopping cart" ||
        title === "cart" ||

        testid.indexOf("shoppingbag") >= 0 ||
        testid.indexOf("shopping-bag") >= 0 ||
        testid.indexOf("cart") >= 0 ||

        id.indexOf("shoppingbag") >= 0 ||
        id.indexOf("shopping-bag") >= 0 ||

        cls.indexOf("shoppingbag") >= 0 ||
        cls.indexOf("shopping-bag") >= 0;

      if(cartDestination || cartControl){
        return true;
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }
  function isFirstCryPurchaseAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("firstcry") < 0){
      return false;
    }

    var depth = 0;

    /*
     * FirstCry often attaches purchase behaviour to DIV/SPAN
     * containers rather than a normal HTML button.
     *
     * Therefore inspect the tapped element AND its ancestors,
     * instead of requiring button/a/input.
     */
    while(el && el !== document.body && depth < 12){

      var role = cleanClickText(
        (el.getAttribute && el.getAttribute("role")) || ""
      );

      var type = cleanClickText(
        (el.getAttribute && el.getAttribute("type")) || ""
      );

      /*
       * Search controls must always remain usable.
       */
      if(
        type === "search" ||
        role === "search" ||
        role === "searchbox"
      ){
        return false;
      }

      var visible = cleanClickText(
        el.innerText ||
        el.textContent ||
        ""
      );

      /*
       * Do not let a huge page/container ancestor trigger
       * a false purchase detection.
       */
      if(visible.length > 100){
        visible = "";
      }

      var aria = cleanClickText(
        (el.getAttribute && el.getAttribute("aria-label")) || ""
      );

      var title = cleanClickText(
        (el.getAttribute && el.getAttribute("title")) || ""
      );

      var value = cleanClickText(
        (el.getAttribute && el.getAttribute("value")) || ""
      );

      var id = cleanClickText(
        (el.getAttribute && el.getAttribute("id")) || ""
      );

      var cls = cleanClickText(
        (el.getAttribute && el.getAttribute("class")) || ""
      );

      var testid = cleanClickText(
        (el.getAttribute && el.getAttribute("data-testid")) || ""
      );

      var combined = cleanClickText(
        visible + " " +
        aria + " " +
        title + " " +
        value + " " +
        id + " " +
        cls + " " +
        testid
      );

      /*
       * Exact FirstCry purchasing actions.
       */
      if(
        visible === "add to cart" ||
        visible === "go to cart" ||
        visible === "buy now" ||
        visible === "add to bag" ||
        visible === "checkout" ||

        combined.indexOf("add to cart") >= 0 ||
        combined.indexOf("addtocart") >= 0 ||
        combined.indexOf("add-to-cart") >= 0 ||

        combined.indexOf("go to cart") >= 0 ||
        combined.indexOf("gotocart") >= 0 ||
        combined.indexOf("go-to-cart") >= 0 ||

        combined.indexOf("buy now") >= 0 ||
        combined.indexOf("buynow") >= 0 ||
        combined.indexOf("buy-now") >= 0 ||

        combined.indexOf("checkout") >= 0
      ){
        return true;
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }
  function isBoatPurchaseAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("boat") < 0){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 8){
      var tag = (el.tagName || "").toLowerCase();

      var role = cleanClickText(
        (el.getAttribute && el.getAttribute("role")) || ""
      );

      var type = cleanClickText(
        (el.getAttribute && el.getAttribute("type")) || ""
      );

      /*
       * Search and variant controls remain usable.
       */
      if(
        type === "search" ||
        role === "search" ||
        role === "searchbox"
      ){
        return false;
      }

      var clickable =
        tag === "button" ||
        tag === "a" ||
        tag === "input" ||
        role === "button";

      if(clickable){
        var visible = getVisibleText(el);

        if(visible.length > 70){
          visible = "";
        }

        var aria = cleanClickText(
          (el.getAttribute && el.getAttribute("aria-label")) || ""
        );

        var title = cleanClickText(
          (el.getAttribute && el.getAttribute("title")) || ""
        );

        var value = cleanClickText(
          (el.getAttribute && el.getAttribute("value")) || ""
        );

        var combined = cleanClickText(
          visible + " " +
          aria + " " +
          title + " " +
          value
        );

        if(
          combined === "add to cart" ||
          combined === "add to bag" ||
          combined === "buy now" ||
          combined === "buy it now" ||
          combined === "checkout" ||
          combined === "go to cart" ||
          combined.indexOf("add to cart") === 0 ||
          combined.indexOf("add to bag") === 0 ||
          combined.indexOf("buy now") === 0 ||
          combined.indexOf("buy it now") === 0 ||
          combined.indexOf("checkout") === 0 ||
          combined.indexOf("go to cart") === 0
        ){
          return true;
        }
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }

  function isNykaaPurchaseAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("nykaa") < 0){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 7){
      var tag = (el.tagName || "").toLowerCase();

      var role = cleanClickText(
        (el.getAttribute && el.getAttribute("role")) || ""
      );

      var type = cleanClickText(
        (el.getAttribute && el.getAttribute("type")) || ""
      );

      var href = cleanClickText(
        (el.getAttribute && el.getAttribute("href")) || ""
      );

      /*
       * Nykaa search must always remain usable.
       */
      if(
        type === "search" ||
        role === "search" ||
        role === "searchbox"
      ){
        return false;
      }

      var aria = cleanClickText(
        (el.getAttribute && el.getAttribute("aria-label")) || ""
      );

      var title = cleanClickText(
        (el.getAttribute && el.getAttribute("title")) || ""
      );

      var value = cleanClickText(
        (el.getAttribute && el.getAttribute("value")) || ""
      );

      /*
       * Only inspect actual clickable controls.
       *
       * Do NOT inspect large product-card/page containers because
       * those containers may also contain an "Add to Bag" child.
       */
      var clickable =
        tag === "button" ||
        tag === "a" ||
        tag === "input" ||
        role === "button";

      if(clickable){
        var visible = getVisibleText(el);

        /*
         * Large link/card text is product navigation, not a
         * purchase button.
         */
        if(visible.length > 55){
          visible = "";
        }

        var combined = cleanClickText(
          visible + " " +
          aria + " " +
          title + " " +
          value
        );

        var purchaseAction =
          combined === "add to bag" ||
          combined === "add to cart" ||
          combined === "buy now" ||
          combined === "go to bag" ||
          combined === "go to cart" ||
          combined === "checkout" ||
          combined.indexOf("add to bag") === 0 ||
          combined.indexOf("add to cart") === 0 ||
          combined.indexOf("buy now") === 0 ||
          combined.indexOf("go to bag") === 0 ||
          combined.indexOf("go to cart") === 0 ||
          combined.indexOf("checkout") === 0;

        if(purchaseAction){
          return true;
        }

        /*
         * Ordinary Nykaa links are safe:
         * product pages, categories, search results, etc.
         */
        if(
          tag === "a" &&
          href &&
          href.indexOf("/cart") < 0 &&
          href.indexOf("/bag") < 0 &&
          href.indexOf("/checkout") < 0
        ){
          return false;
        }
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }
  function isMyntraPurchaseAction(el){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("myntra") < 0){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 12){
      var text = cleanClickText(
        el.innerText ||
        el.textContent ||
        ""
      );

      var aria = cleanClickText(
        (el.getAttribute && el.getAttribute("aria-label")) || ""
      );

      var title = cleanClickText(
        (el.getAttribute && el.getAttribute("title")) || ""
      );

      var value = cleanClickText(
        (el.getAttribute && el.getAttribute("value")) || ""
      );

      var combined = cleanClickText(
        text + " " +
        aria + " " +
        title + " " +
        value
      );

      /*
       * Do not interfere with size/colour selection.
       */
      if(
        combined === "xs" ||
        combined === "s" ||
        combined === "m" ||
        combined === "l" ||
        combined === "xl" ||
        combined === "xxl" ||
        combined === "xxxl"
      ){
        return false;
      }

      if(
        combined === "add to bag" ||
        combined === "go to bag" ||
        combined === "buy now" ||
        combined.indexOf("add to bag") >= 0 ||
        combined.indexOf("go to bag") >= 0 ||
        combined.indexOf("buy now") >= 0
      ){
        return true;
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }

  function findClickedButton(el){
    if(isSafeProductNavigation(el)){
      return false;
    }

    var depth = 0;

    while(el && el !== document.body && depth < 6){
      var visibleText = getVisibleText(el);

      if(isQuantityOrVariantText(visibleText)){
        return false;
      }

      var ownText = getOwnButtonText(el);

      if(isInteractiveElement(el)){
        if(isStoreAddButtonText(ownText) || isStoreAddButtonText(visibleText)){
          return true;
        }
      }

      el = el.parentElement;
      depth++;
    }

    return false;
  }

  var lastBlockedAt = 0;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartedAt = 0;

  function notifyBlockedOnce(){
    var now = Date.now();

    if(now - lastBlockedAt > 1000){
      lastBlockedAt = now;
      notifyStoreCart("store add button blocked");
    }
  }

  // Stop store authentication and purchasing actions before the website handles them.
 function blockStoreCartAction(e){
  var clickedAuthButton = isBoatAuthAction(e.target) || findAuthButton(e.target);
  var clickedAddButton = isAjioPurchaseAction(e.target) || isIkeaPurchaseAction(e.target) || isFirstCryPurchaseAction(e.target) || isBoatPurchaseAction(e.target) || isNykaaPurchaseAction(e.target) || isMyntraPurchaseAction(e.target) || isFlipkartPurchaseAction(e.target) || findClickedButton(e.target);

  if(clickedAuthButton || clickedAddButton){
    try{
      e.preventDefault();
      e.stopPropagation();

      if(e.stopImmediatePropagation){
        e.stopImmediatePropagation();
      }
    }catch(err){}

    if(clickedAuthButton){
      notifyAuthBlocked("store auth blocked");
    } else {
      notifyBlockedOnce();
    }

    return false;
  }

  return true;
}

  function onTouchStart(e){
    try{
      /*
       * boAt account/KwikPass opens very early in the touch sequence.
       */
      if(isBoatAuthAction(e.target)){
        e.preventDefault();
        e.stopPropagation();

        if(e.stopImmediatePropagation){
          e.stopImmediatePropagation();
        }

        notifyAuthBlocked("boAt auth blocked");

        return false;
      }

      /*
       * Myntra handles its Add to Bag action very early in the
       * touch sequence. Stop it here in capture phase before the
       * website can add the product to its own bag.
       */
      if(isAjioPurchaseAction(e.target) || isIkeaPurchaseAction(e.target) || isFirstCryPurchaseAction(e.target) || isBoatPurchaseAction(e.target) || isNykaaPurchaseAction(e.target) || isMyntraPurchaseAction(e.target)){
        e.preventDefault();
        e.stopPropagation();

        if(e.stopImmediatePropagation){
          e.stopImmediatePropagation();
        }

        notifyBlockedOnce();

        return false;
      }

      var t = e.touches && e.touches[0];

      if(t){
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartedAt = Date.now();
      }
    }catch(err){}

    return true;
  }
  function onTouchEnd(e){
    try{
      var t = e.changedTouches && e.changedTouches[0];
      if(!t) return true;

      var dx = Math.abs(t.clientX - touchStartX);
      var dy = Math.abs(t.clientY - touchStartY);
      var dt = Date.now() - touchStartedAt;

      if(dx > 12 || dy > 12 || dt > 900){
        return true;
      }

      return blockStoreCartAction(e);
    }catch(err){
      return true;
    }
  }

  // Expose scraping to React Native and monitor taps in the capture phase.
  function dismissBoatAuthPopup(){
    var h = location.hostname.toLowerCase();

    if(h.indexOf("boat") < 0){
      return;
    }

    var candidates = document.querySelectorAll(
      "[role='dialog'], [class*='modal'], [class*='Modal'], [class*='popup'], [class*='Popup'], [class*='kwik'], [id*='kwik']"
    );

    for(var i = 0; i < candidates.length; i++){
      var modal = candidates[i];

      var text = cleanClickText(
        modal.innerText ||
        modal.textContent ||
        ""
      );

      var isAuthPopup =
        text.indexOf("register to avail") >= 0 ||
        text.indexOf("enter mobile number") >= 0 ||
        text.indexOf("please enter mobile number") >= 0 ||
        text.indexOf("kwikpass") >= 0 ||
        (
          text.indexOf("get started") >= 0 &&
          text.indexOf("mobile number") >= 0
        );

      if(!isAuthPopup){
        continue;
      }

      /*
       * Try the popup's own close control first.
       */
      var controls = modal.querySelectorAll(
        "button, a, [role='button'], [aria-label], [title]"
      );

      var closed = false;

      for(var j = 0; j < controls.length; j++){
        var control = controls[j];

        var label = cleanClickText(
          ((control.getAttribute && control.getAttribute("aria-label")) || "") +
          " " +
          ((control.getAttribute && control.getAttribute("title")) || "") +
          " " +
          (control.innerText || control.textContent || "")
        );

        if(
          label === "x" ||
          label === "ÃƒÆ’Ã¢â‚¬â€" ||
          label === "close" ||
          label.indexOf("close") >= 0
        ){
          try{
            control.click();
            closed = true;
          }catch(err){}

          break;
        }
      }

      /*
       * If KwikPass exposes no usable close control,
       * hide only that authentication modal.
       */
      if(!closed){
        try{
          modal.style.setProperty(
            "display",
            "none",
            "important"
          );
        }catch(err){}
      }
    }
  }

  if(location.hostname.toLowerCase().indexOf("boat") >= 0){
    dismissBoatAuthPopup();

    try{
      var boatAuthObserver = new MutationObserver(function(){
        dismissBoatAuthPopup();
      });

      boatAuthObserver.observe(
        document.documentElement || document.body,
        {
          childList: true,
          subtree: true
        }
      );
    }catch(err){}
  }
  window.__miScrape = scrape;

  document.addEventListener("touchstart", onTouchStart, true);
  document.addEventListener("touchend", onTouchEnd, true);
  document.addEventListener("click", blockStoreCartAction, true);

  true;
})();
`;

export default function Browser() {
  // Read the selected store URL and display name from the route.
  const { url, name } = useLocalSearchParams<{ url: string; name: string }>();
  const router = useRouter();

  // Build the active color palette and styles from the device color scheme.
  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const st = makeStyles(COLORS);

  // Access shared cart actions and keep references used by the embedded browser.
  const { addToCart, cartCount } = useStore();
  const webRef = useRef<WebView>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);

  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  // Track loading, scraped product data, navigation, guidance, and warning UI.
  const [initialLoading, setInitialLoading] = useState(true);
  const [pending, setPending] = useState<any>(null);
  const [currentUrl, setCurrentUrl] = useState(String(url || ""));
  const [showGuide, setShowGuide] = useState(true);
  const [isStoreCartPage, setIsStoreCartPage] = useState(false);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 4,

      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },

      onPanResponderRelease: (_, gestureState) => {
        const shouldClose = gestureState.dy > 120 || gestureState.vy > 1.1;

        if (shouldClose) {
          Animated.timing(sheetTranslateY, {
            toValue: 500,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setPending(null);
            sheetTranslateY.setValue(0);
          });
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;
  const [browserWarning, setBrowserWarning] = useState(
    "Please use the Mr India cart below. Do not add or pay through the store's own cart.",
  );

  const insets = useSafeAreaInsets();

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (warningTimer.current) {
        clearTimeout(warningTimer.current);
      }
    };
  }, []);

  // Reset browser state whenever a different store URL is opened
  useEffect(() => {
    if (!isMountedRef.current) return;

    setInitialLoading(true);
    setPending(null);
    setCurrentUrl(String(url || ""));
    setShowGuide(true);
    setIsStoreCartPage(false);
  }, [url]);

  // Prevent the full-page loading overlay from remaining visible indefinitely.
  useEffect(() => {
    const t = setTimeout(() => {
      if (isMountedRef.current) {
        setInitialLoading(false);
      }
    }, 4000);

    return () => clearTimeout(t);
  }, [currentUrl]);

  // Temporarily warn the shopper after a store cart or checkout action is blocked.
  const showStoreCartWarning = useCallback(() => {
    if (!isMountedRef.current) return;

    setBrowserWarning(
      "Please use the Mr India cart below. Do not add or pay through the store's own cart.",
    );

    setIsStoreCartPage(true);
    setShowGuide(false);

    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
    }

    warningTimer.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsStoreCartPage(false);
      }
    }, 3000);
  }, []);

  // Temporarily warn the shopper after a store authentication action is blocked.
  const showAuthWarning = useCallback(() => {
    if (!isMountedRef.current) return;

    setBrowserWarning(
      "Please do not sign in or create an account on the store website. Continue browsing and order through Mr India.",
    );

    setIsStoreCartPage(true);
    setShowGuide(false);

    if (warningTimer.current) {
      clearTimeout(warningTimer.current);
    }

    warningTimer.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsStoreCartPage(false);
      }
    }, 5000);
  }, []);

  // Ask the WebView to scrape the visible product and send its data to React Native.
  function scrapeCurrentPage() {
    webRef.current?.injectJavaScript(`
    try {
      if (window.__miScrape) {
        window.ReactNativeWebView.postMessage(JSON.stringify(window.__miScrape()));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          name: document.querySelector("#productTitle")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || document.title || "Product",
          inr: 0,
          store: location.hostname,
          link: location.href,
          image: "",
          options: ""
        }));
      }
    } catch(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        name: document.querySelector("#productTitle")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || document.title || "Product",
        inr: 0,
        store: location.hostname,
        link: location.href,
        image: "",
        options: ""
      }));
    }
    true;
  `);
  }

  async function onMessage(e: any) {
    try {
      const p = JSON.parse(e.nativeEvent.data);

      if (p.type === "STORE_CART_DETECTED") {
        setTimeout(() => {
          showStoreCartWarning();
        }, 0);
        return;
      }

      if (p.type === "STORE_AUTH_BLOCKED") {
        setTimeout(() => {
          showAuthWarning();
        }, 0);
        return;
      }

      if (p?.__boatDebug) {
        console.log("========== BOAT PRICE DEBUG ==========");
        console.log(JSON.stringify(p.__boatDebug, null, 2));
      }

      if (p?.__ajioDebug) {
        console.log("========== AJIO PRICE DEBUG ==========");
        console.log(JSON.stringify(p.__ajioDebug, null, 2));
      }
      const sourcePrice = Number(p.inr || 0);

      if (!sourcePrice) {
        if (isMountedRef.current) {
          setPending({
            ...p,
            sourcePrice: 0,
            sourceCurrency: "INR",
            displayPrice: 0,
            displayCurrency: "MUR",
          });
        }

        return;
      }

      console.log("========== ODOO CURRENCY CONVERSION ==========");
      console.log("SOURCE:", sourcePrice, "INR");

      const conversion = await api.convertCurrency(sourcePrice, "INR", "MUR");

      console.log("ODOO CURRENCY RESULT:", JSON.stringify(conversion, null, 2));

      const displayPrice = Number(conversion?.data?.target?.amount || 0);

      const displayCurrency = conversion?.data?.target?.currency || "MUR";

      if (isMountedRef.current) {
        setPending({
          ...p,

          sourcePrice,
          sourceCurrency: "INR",

          displayPrice,
          displayCurrency,
        });
      }
    } catch (error) {
      console.log("CURRENCY CONVERSION ERROR:", error);
    }
  }

  function confirmAdd() {
    const options = String(pending?.options || "").trim();

    /*
     * The WebView already detects variants in this format:
     *
     * Size: Free - Color: multi
     *
     * Keep the original options text for display, but also save
     * size and color separately so Odoo can store them on the
     * sale.order.line.
     */
    const sizeMatch = options.match(
      /Size:\s*(.*?)(?:\s+(?:-|Ãƒâ€šÃ‚Â·|\|)\s+Color:|$)/i,
    );

    const colorMatch = options.match(/Color:\s*(.*)$/i);

    const selectedSize = String(pending?.size || sizeMatch?.[1] || "").trim();

    const selectedColor = String(
      pending?.color || colorMatch?.[1] || "",
    ).trim();

    console.log("========== CART PRODUCT VARIANTS ==========");
    console.log("OPTIONS:", options);
    console.log("SIZE:", selectedSize || "(none)");
    console.log("COLOR:", selectedColor || "(none)");

    addToCart({
      id: "w" + Date.now(),

      name: pending.name,

      sourcePrice: Number(pending.sourcePrice || 0),
      sourceCurrency: pending.sourceCurrency || "INR",

      displayPrice: Number(pending.displayPrice || 0),
      displayCurrency: pending.displayCurrency || "MUR",

      store: pending.store,
      link: pending.link,
      image: pending.image,

      options,
      size: selectedSize,
      color: selectedColor,

      e: "\uD83D\uDCE6",
    });

    setPending(null);
  }
  return (
    <SafeAreaView style={st.safe} edges={["top", "left", "right"]}>
      <View style={st.wrap}>
        {/* Browser header with back navigation, store name, and cart access. */}
        <View style={st.bar}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
            style={st.barBtn}
          >
            <Text style={st.barBtnTxt}>{"< Back"}</Text>
          </TouchableOpacity>
          <Text style={st.barTitle} numberOfLines={1}>
            {name}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/cart")}
            style={[st.barBtn, st.cartBtn]}
          >
            <Text style={st.barBtnTxt}>Cart</Text>

            {cartCount > 0 && (
              <View style={st.cartBadge}>
                <Text style={st.cartBadgeTxt}>
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Embedded store browser with scraping, navigation filtering, and injected safeguards. */}
        <WebView
          key={currentUrl}
          ref={webRef}
          style={st.web}
          source={{ uri: currentUrl }}
          injectedJavaScript={INJECTED}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(req) => {
            const u = req.url.toLowerCase();

            const blockedStoreCartPage =
              u.includes("/checkout") ||
              u.includes("/cart") ||
              u.includes("/basket") ||
              u.includes("/shopping-bag") ||
              u.includes("/shoppingbag") ||
              u.includes("shopping-cart") ||
              u.includes("shoppingcart");

            const blockedAuthPage =
              u.includes("/login") ||
              u.includes("/signin") ||
              u.includes("/sign-in") ||
              u.includes("/signup") ||
              u.includes("/sign-up") ||
              u.includes("/register") ||
              u.includes("/registration") ||
              u.includes("/account") ||
              u.includes("/customer/account") ||
              u.includes("/auth");

            if (blockedStoreCartPage) {
              setTimeout(() => {
                showStoreCartWarning();
              }, 0);

              return false;
            }

            if (blockedAuthPage) {
              setTimeout(() => {
                showAuthWarning();
              }, 0);

              return false;
            }

            return true;
          }}
          onLoadStart={() => {}}
          onLoadEnd={() => {
            setTimeout(() => {
              if (isMountedRef.current) {
                setInitialLoading(false);
              }
            }, 300);
          }}
          onNavigationStateChange={(nav) => {
            webRef.current?.injectJavaScript(INJECTED);

            const u = nav.url.toLowerCase();

            const cartLikePage =
              u.includes("/checkout") ||
              u.includes("/cart") ||
              u.includes("/basket") ||
              u.includes("/shopping-bag") ||
              u.includes("/shoppingbag") ||
              u.includes("shopping-cart") ||
              u.includes("shoppingcart");

            if (cartLikePage) {
              setTimeout(() => {
                showStoreCartWarning();
              }, 0);
            } else if (isMountedRef.current) {
              setIsStoreCartPage(false);
            }
          }}
          startInLoadingState={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          setSupportMultipleWindows={false}
        />

        {/* Full-page indicator shown while the store initially loads. */}
        {initialLoading && (
          <View style={st.fullLoader}>
            <ActivityIndicator color={COLORS.amber} size="large" />
            <Text style={st.loadingText}>Loading {name || "store"}...</Text>
          </View>
        )}

        {/* Dismissible instructions explaining how to shop through Mr India. */}
        {showGuide && (
          <View style={st.guideCard}>
            <View style={st.guideTop}>
              <View style={st.guideIcon}>
                <Text style={st.guideIconTxt}>i</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={st.guideTitle}>Quick shopping tips</Text>
                <Text style={st.guideSub}>
                  You are browsing the store's own website. Do not pay there -
                  add products through Mr India.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowGuide(false)}
                style={st.guideCloseBtn}
              >
                <Text style={st.guideClose}>{"\u00D7"}</Text>
              </TouchableOpacity>
            </View>

            <View style={st.tipsRow}>
              <View style={st.tipPill}>
                <Text style={st.tipTxt}>Browse freely</Text>
              </View>

              <View style={st.tipPill}>
                <Text style={st.tipTxt}>No store login needed</Text>
              </View>

              <View style={st.tipPill}>
                <Text style={st.tipTxt}>Close pop-ups</Text>
              </View>
            </View>
          </View>
        )}

        {/* Persistent action area for warnings or the Mr India purchase button. */}
        <View
          style={[st.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          {isStoreCartPage ? (
            <View style={st.cartWarning}>
              <Text style={st.cartWarningTxt}>{browserWarning}</Text>
            </View>
          ) : (
            <>
              {showGuide && (
                <View style={st.actionMiniGuide}>
                  <Text style={st.actionHint}>Found the product?</Text>
                  <Text style={st.actionSub}>
                    Select size/color on the store page, then add it through Mr
                    India.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.9}
                style={st.actionBtn}
                onPress={scrapeCurrentPage}
              >
                <Text style={st.actionBtnTxt}>Shop via Mr India</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Modal
          visible={!!pending}
          transparent
          animationType="slide"
          onRequestClose={() => setPending(null)}
        >
          <View style={st.sheetWrap}>
            <Animated.View
              style={[
                st.sheet,
                {
                  transform: [
                    {
                      translateY: sheetTranslateY,
                    },
                  ],
                },
              ]}
            >
              <View {...sheetPanResponder.panHandlers}>
                <View style={st.handle} />
              </View>
              {/* <Text style={st.sheetTitle}>Add to your Mr India cart?</Text> */}
              <View style={st.sheetTitleRow}>
                <View style={st.sheetIcon}>
                  <Ionicons
                    name="cart-outline"
                    size={22}
                    color={COLORS.amber}
                  />
                </View>
                <Text style={st.sheetTitle}>Add to Cart</Text>
              </View>
              {pending && (
                <View style={st.row}>
                  {pending.image ? (
                    <Image source={{ uri: pending.image }} style={st.img} />
                  ) : (
                    <View style={st.img} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={st.name} numberOfLines={3}>
                      {pending.name}
                    </Text>

                    <Text style={st.meta}>
                      {pending.store}
                      {pending.sourcePrice
                        ? ` - INR ${pending.sourcePrice} (~ ${money(
                            pending.displayPrice || 0,
                          )})`
                        : ""}
                    </Text>
                    {!!pending.options && (
                      <Text style={st.meta}>{pending.options}</Text>
                    )}
                  </View>
                </View>
              )}
              <View style={st.infoBox}>
                <Text style={st.infoTxt}>
                  Please ensure you've selected the correct size, color, and
                  other variants on the product page. These details will define
                  the product being purchased and cannot be changed later.
                </Text>
              </View>
              <TouchableOpacity style={st.cta} onPress={confirmAdd}>
                {/* <Text style={st.ctaTxt}>Add to Mr India cart -></Text> */}
                <Text style={st.ctaTxt}>Add to Mr India Cart</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.cancel}
                onPress={() => setPending(null)}
              >
                <Text style={st.cancelTxt}>Keep browsing</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// Create theme-aware styles for the embedded browser and confirmation sheet.
const makeStyles = (COLORS: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.bg2,
    },
    wrap: { flex: 1, backgroundColor: COLORS.bg },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 13,
      backgroundColor: COLORS.bg2,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    //   barBtn: { padding: 6 },
    barBtn: {
      paddingVertical: 6,
      minWidth: 70,
    },
    barBtnTxt: {
      color: COLORS.amber,
      fontWeight: "800",
      fontSize: 15,
    },

    barTitle: {
      color: COLORS.t1,
      fontWeight: "900",
      fontSize: 17,
      flex: 1,
      textAlign: "center",
      letterSpacing: -0.2,
    },

    loader: {
      position: "absolute",
      top: 48,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    sheet: {
      backgroundColor: COLORS.bg2,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 22,
      paddingBottom: 42,
    },
    handle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: COLORS.border,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetTitle: {
      color: COLORS.t1,
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 16,
    },
    row: { flexDirection: "row", gap: 13, marginBottom: 14 },
    img: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: COLORS.card2,
    },
    name: { color: COLORS.t1, fontSize: 14, fontWeight: "700", lineHeight: 19 },
    meta: { color: COLORS.amber2, fontSize: 13, marginTop: 4 },
    note: { color: COLORS.t2, fontSize: 12, lineHeight: 18, marginBottom: 16 },
    cta: {
      backgroundColor: COLORS.amber,
      borderRadius: 12,
      padding: 15,
      alignItems: "center",
    },
    ctaTxt: { color: COLORS.bg, fontWeight: "800", fontSize: 15 },
    cancel: { padding: 13, alignItems: "center" },
    cancelTxt: { color: COLORS.t2, fontWeight: "600", fontSize: 14 },

    web: {
      flex: 1,
    },
    cartBtn: {
      position: "relative",
      alignItems: "flex-end",
    },

    cartBadge: {
      position: "absolute",
      top: -2,
      right: -8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: COLORS.rose,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
      borderWidth: 1,
      borderColor: COLORS.bg2,
    },

    cartBadgeTxt: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "900",
    },
    fullLoader: {
      position: "absolute",
      top: 55,
      left: 0,
      right: 0,
      bottom: 86,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
    },

    loadingText: {
      color: COLORS.t2,
      fontSize: 13,
      marginTop: 12,
      fontWeight: "700",
    },

    miniLoader: {
      position: "absolute",
      top: 58,
      right: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.bg2,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      zIndex: 60,
    },

    miniLoaderTxt: {
      color: COLORS.t2,
      fontSize: 11,
      fontWeight: "700",
    },
    guideCard: {
      position: "absolute",
      left: 14,
      right: 14,
      top: 70,
      backgroundColor: COLORS.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      zIndex: 40,

      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },

    guideTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    guideIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: COLORS.amber,
      alignItems: "center",
      justifyContent: "center",
    },

    guideIconTxt: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "900",
      fontStyle: "italic",
    },

    guideTitle: {
      color: COLORS.t1,
      fontSize: 17,
      fontWeight: "900",
    },

    guideSub: {
      color: COLORS.t3,
      fontSize: 12,
      marginTop: 3,
      lineHeight: 17,
    },

    guideCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    guideClose: {
      color: COLORS.t2,
      fontSize: 28,
      fontWeight: "400",
      marginTop: -2,
    },

    tipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },

    tipPill: {
      backgroundColor: COLORS.bg2,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },

    tipTxt: {
      color: COLORS.t2,
      fontSize: 11,
      fontWeight: "800",
    },

    actionBar: {
      backgroundColor: COLORS.bg2,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      shadowColor: "#000",
      shadowOpacity: COLORS.bg === "#131F2A" ? 0.28 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: -5 },
      elevation: 12,
    },

    actionMiniGuide: {
      alignItems: "center",
      marginBottom: 10,
    },

    actionHint: {
      color: COLORS.t1,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "900",
    },

    actionSub: {
      color: COLORS.t3,
      textAlign: "center",
      fontSize: 12,
      marginTop: 3,
    },

    actionBtn: {
      backgroundColor: COLORS.amber,
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",

      shadowColor: COLORS.amber,
      shadowOpacity: 0.24,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 8,
    },

    actionBtnTxt: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 17,
      letterSpacing: -0.2,
    },

    cartWarning: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
    },

    cartWarningTxt: {
      color: COLORS.t2,
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
      fontWeight: "700",
    },
    sheetTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 18,
    },

    sheetIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: COLORS.bg,
      alignItems: "center",
      justifyContent: "center",
    },

    sheetIconTxt: {
      fontSize: 22,
    },

    infoBox: {
      backgroundColor:
        COLORS.bg === "#131F2A" ? "rgba(225,108,0,0.12)" : "#FFF3E6",
      borderWidth: 1,
      borderColor: COLORS.bg === "#131F2A" ? "rgba(255,122,5,0.28)" : "#F1CBAA",
      borderRadius: 16,
      padding: 15,
      marginBottom: 18,
    },

    infoTxt: {
      color: COLORS.t2,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "600",
    },
  });







