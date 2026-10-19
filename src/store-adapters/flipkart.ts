// /**
//  * Flipkart store adapter for the Mr India WebView browser.
//  *
//  * Responsibilities:
//  * - Detect Flipkart product pages
//  * - Read the current product title
//  * - Read the currently selected variant price
//  * - Read the main product image
//  * - Read selected size / colour / other variants
//  * - Return normalized product data to the common browser bridge
//  *
//  * Navigation, warning popups, back handling and WebView behaviour
//  * remain inside src/app/browser.tsx.
//  */

/** Flipkart product-page adapter for the Mr India WebView. */
export const FLIPKART_ADAPTER_JS = String.raw`
(function () {
  // Replacing an older adapter after a WebView navigation should be safe.
  if (window.__miFlipkartAdapter && window.__miFlipkartAdapter.version === 2) return;

  function clean(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
  function nodeText(el) { return clean(el && (el.innerText || el.textContent)); }
  function meta(key) {
    var el = document.querySelector('meta[property="' + key + '"],meta[name="' + key + '"]');
    return clean(el && el.getAttribute('content'));
  }
  function hostOK() { return /(^|\.)flipkart\.com$/i.test(location.hostname); }
  function isProductPage() { return hostOK() && (/\/p\//.test(location.pathname) || !!document.querySelector('h1')); }
  function getTitle() {
    var selectors = ['span.B_NuCI', '.VU-ZEz', '.yhB1nd', 'h1'];
    for (var i=0;i<selectors.length;i++) {
      var value = nodeText(document.querySelector(selectors[i]));
      if (value.length > 3) return value.slice(0,240);
    }
    return (meta('og:title') || meta('twitter:title') || clean(document.title) || 'Flipkart product').slice(0,240);
  }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0 || r.width <= 0 || r.height <= 0) return false;
    for (var p=el.parentElement, depth=0;p && depth<5;p=p.parentElement,depth++) {
      var ps=getComputedStyle(p);
      if (ps.display==='none' || ps.visibility==='hidden' || Number(ps.opacity)===0) return false;
    }
    return true;
  }
  function getImage() {
    var selectors=['img._396cs4','img.DByuf4','img[src*="rukminim"]'];
    for(var i=0;i<selectors.length;i++) {
      var nodes=document.querySelectorAll(selectors[i]);
      for(var j=0;j<nodes.length;j++) {
        var el=nodes[j], src=el.currentSrc || el.getAttribute('src') || el.getAttribute('data-src');
        if (visible(el) && src && /^https?:\/\//i.test(src)) return src;
      }
    }
    return meta('og:image') || meta('twitter:image') || '';
  }
  function amount(v) {
    var m=clean(v).match(/(?:₹|INR|Rs\.?)[\s]*([\d,]+(?:\.\d{1,2})?)/i);
    return m ? Number(m[1].replace(/,/g,'')) || 0 : 0;
  }
  var feeWords=/protect promise|protection fee|secure packaging|handling fee|delivery fee|exchange offer|up to ₹|per\s*100\s*g|\/100g/i;
  var promoWords=/buy at|apply offers?|maximum savings|bank offers?|coupon|cashback|\bemi\b|wow!? deal|exchange offer/i;
  var productBoundaries=/similar products|you may also like|recommended for you|frequently bought|ratings & reviews|customer reviews|product details|seller details/i;
  function getPageLines() {
    return String(document.body && document.body.innerText || '').split(/\r?\n/).map(clean).filter(Boolean);
  }
  function titleLineIndex(lines,title) {
    var anchor=clean(title).slice(0, Math.min(30, title.length)).toLowerCase();
    if(anchor.length<6) return -1;
    for(var i=0;i<lines.length;i++) if(lines[i].toLowerCase().indexOf(anchor)>=0) return i;
    return -1;
  }
  function validPriceLine(line) {
    var t=clean(line);
    return !!t && !promoWords.test(t) && !feeWords.test(t) && !/^(?:mrp|₹\s*[\d,]+\s*\/)/i.test(t);
  }
  function priceFromSection(lines,title) {
    var idx=titleLineIndex(lines,title);
    if(idx<0) return 0;
    // The title is directly followed by the normal price, while promotions and fees follow it.
    for(var i=idx+1, end=Math.min(lines.length,idx+24);i<end;i++) {
      var line=lines[i];
      if(promoWords.test(line) || feeWords.test(line) || productBoundaries.test(line)) break;
      // For mixed MRP/discount lines, the sale price is normally the last rupee token.
      var tokens=line.match(/₹\s*[\d,]+(?:\.\d{1,2})?/g);
      if(!tokens || !validPriceLine(line)) continue;
      var values=tokens.map(amount).filter(function(v){return v>0;});
      if(!values.length) continue;
      if(/%\s*(?:off)?|\boff\b|discount/i.test(line)) return values[values.length-1];
      if(values.length>=2) {
        // MRP is usually larger; choose the selling price in the product price block.
        return Math.min.apply(Math,values);
      }
      if(/^₹\s*[\d,]+(?:\.\d{1,2})?$/.test(line)) return values[0];
    }
    return 0;
  }
  function priceFromDOM(title) {
    var nodes=document.querySelectorAll('.Nx9bqj,._30jeq3,._16Jk6d,[class*="Nx9bqj"],div,span,strong,b');
    var titleEl=document.querySelector('h1,.VU-ZEz,span.B_NuCI,.yhB1nd');
    var titleY=titleEl && titleEl.getBoundingClientRect ? titleEl.getBoundingClientRect().top : null;
    var best=0, bestScore=Infinity;
    for(var i=0;i<nodes.length;i++) {
      var el=nodes[i], tx=nodeText(el);
      if(!/^₹\s*[\d,]+(?:\.\d{1,2})?$/.test(tx) || !visible(el)) continue;
      var bad=false;
      for(var p=el.parentElement, d=0;p && p!==document.body && d<5;p=p.parentElement,d++) {
        var txt=nodeText(p);
        if(txt.length<180 && (promoWords.test(txt) || feeWords.test(txt))) { bad=true;break; }
      }
      if(bad) continue;
      var r=el.getBoundingClientRect();
      var score=titleY==null ? Math.abs(r.top) : Math.abs(r.top-titleY);
      // Ignore pricing physically far above the main title (recommended tiles).
      if(titleY!=null && r.top<titleY-45) continue;
      if(score<bestScore) {bestScore=score;best=amount(tx);}
    }
    return best;
  }
  function getPriceDetails() {
    if (!hostOK() || !isProductPage()) {
      return {price:0,source:'not-product'};
    }

    var title=getTitle();
    var lines=getPageLines();

    // Prefer the normal selling price following the current product title.
    // Avoid unrelated prices elsewhere in the Flipkart DOM.
    var sectionPrice=priceFromSection(lines,title);
    var domPrice=priceFromDOM(title);

    // Flipkart can show sponsored product cards before the actual product.
    // Their prices must not override the selected product's selling price.
    var titleIndex=titleLineIndex(lines,title);
    var nearbyLines=titleIndex>=0
      ? lines.slice(titleIndex,Math.min(lines.length,titleIndex+25))
      : [];

    var sponsoredCount=nearbyLines.filter(function(line){
      return /^AD$/i.test(clean(line));
    }).length;

    if(sponsoredCount>=2 && domPrice>0) {
      return {
        price:domPrice,
        source:'dom-sponsored-correction-v5'
      };
    }

    if(sectionPrice>0) {
      return {
        price:sectionPrice,
        source:'product-section-primary-v4'
      };
    }

    // Fallback when the product section contains no verified price.

    if(domPrice>0) {
      return {
        price:domPrice,
        source:'dom-fallback-v4'
      };
    }

    return {
      price:0,
      source:'unverified'
    };
  }
  function getPrice(){return getPriceDetails().price;}
  function normalLabel(label) {
    var l=clean(label).replace(/^selected\s+/i,'').replace(/\s+/g,' ');
    if(/^colou?r$/i.test(l)) return 'Color';
    if(/^strap colou?r$/i.test(l)) return 'Strap Color';
    if(/^size$/i.test(l)) return 'Size';
    if(/^tire size$/i.test(l)) return 'Tire Size';
    if(/^display size$/i.test(l)) return 'Display Size';
    if(/^quantity$/i.test(l)) return 'Quantity';
    if(/^number of storage box(?:es|ses|eses)?$/i.test(l)) return 'Number of Storage Boxes';
    if(/^(?:pack(?: of)?|number of packs|pack size|pack quantity)$/i.test(l)) return 'Pack';
    return l.replace(/\b\w/g,function(ch){return ch.toUpperCase();});
  }
  function validLabel(label) {
    return /^(?:colou?r|strap colou?r|size|tire size|display size|quantity|number of storage box(?:es|ses|eses)?|pack(?: of)?|number of packs|pack size|pack quantity|variant|storage|memory|capacity)$/i.test(clean(label));
  }
  function variantValue(raw) {
    var v=clean(raw).replace(/\s+(?:out of stock|currently unavailable|unavailable|notify me|size chart|visit brand store|delivery details).*$/i,'');
    // Some Flipkart layouts append option lists or prices immediately after selected value.
    v=v.split(/\s+₹\s*\d|\s+\(₹/)[0];
    return clean(v);
  }
  function getVariants() {
    if(!hostOK()) return [];
    var lines=getPageLines(), variants=[];
    function add(name,value){
      name=normalLabel(name);value=variantValue(value);
      if(!name || !value || value.length>70 || /^(select|choose|size chart|out of stock)$/i.test(value)) return;
      for(var i=0;i<variants.length;i++) if(variants[i].name.toLowerCase()===name.toLowerCase()) {variants[i].value=value;return;}
      variants.push({name:name,value:value});
    }
    // Consume visible line labels rather than the entire flattened document.
    for(var i=0;i<lines.length;i++) {
      var m=lines[i].match(/^(?:Selected\s+)?([\w][\w\s/()-]{1,45})\s*:\s*(.*)$/i);
      if(!m || !validLabel(m[1])) continue;
      var value=clean(m[2]);
      if(!value && i+1<lines.length) value=lines[i+1];
      // Prefer the clearly labelled selected option, never the neighboring swatch names.
      add(m[1],value);
    }
    // Some layouts collapse the selected label and value into a single text node.
    if(!variants.length) {
      var body=clean(document.body && document.body.innerText);
      var rx=/Selected\s+(Strap Color|Color|Colour|Size|Tire Size|Display Size|Quantity|Number Of Storage boxeses|Number Of Storage boxes|Pack Size)\s*:\s*(.*?)(?=\s+(?:Selected\s|Visit brand store|Size Chart|₹|$))/gi;
      var m2;while((m2=rx.exec(body))!==null) add(m2[1],m2[2]);
    }
    // Socks and packs may encode their selected quantity only in the active title.
    var title=getTitle();
    var alreadyPack=variants.some(function(v){return /pack|quantity/i.test(v.name);});
    if(!alreadyPack) {
      var pm=title.match(/\b(?:pack\s*of|set\s*of)\s*(\d{1,3})\b/i);
      if(pm) add('Pack',pm[1]);
    }
    return variants;
  }
  function variantsToOptions(v){return v.map(function(x){return x.name+': '+x.value;}).join(' | ');}
  function getStockStatus() {
    if (!hostOK() || !isProductPage()) {
      return {blocked:false,reason:'not-product'};
    }

    var lines=getPageLines();
    var colorIndex=-1;
    var sizeIndex=-1;
    var selectedSize=false;

    for(var i=0;i<lines.length;i++) {
      if(/^(?:Selected\s+)?(?:Color|Colour)\s*:/i.test(lines[i])) {
        colorIndex=i;
      }

      if(/^Selected Size\s*:/i.test(lines[i])) {
        selectedSize=true;
      }
    }

    // A selected size is not blocked by another unavailable swatch.
    if(selectedSize) {
      return {blocked:false,reason:'size-selected'};
    }

    if(colorIndex>=0) {
      for(var j=colorIndex+1;
          j<lines.length && j<colorIndex+35;j++) {
        if(/^Select Size(?:\s|$)/i.test(lines[j])) {
          sizeIndex=j;
          break;
        }
      }
    }

    if(sizeIndex<0) {
      return {blocked:false,reason:'no-matching-size-section'};
    }

    // Do not scan the entire page: unrelated recommendations
    // and colours may also contain "Out of stock".
    var optionLines=lines.slice(colorIndex,sizeIndex+12);
    var hasOutOfStock=optionLines.some(function(line){
      return /out of stock|currently unavailable/i.test(line);
    });

    if(hasOutOfStock) {
      return {
        blocked:true,
        reason:'size-unselected-with-unavailable-options',
        message:'This selection is unavailable or incomplete on Flipkart. Please choose an available colour and size.'
      };
    }

    return {
      blocked:false,
      reason:'no-out-of-stock-evidence'
    };
  }
  function scrape() {
    var details=getPriceDetails(), variants=getVariants(), selectedSize='',selectedColor='';
    for(var i=0;i<variants.length;i++) {
      if(/(?:^|\s)colou?r$/i.test(variants[i].name) && !selectedColor) selectedColor=variants[i].value;
      if(/^(?:size|tire size)$/i.test(variants[i].name) && !selectedSize) selectedSize=variants[i].value;
    }
    var stockStatus=getStockStatus();
    var lines=getPageLines(), index=titleLineIndex(lines,getTitle());
    return {
      adapter:'flipkart',store:'Flipkart',isProductPage:isProductPage(),
      name:getTitle(),inr:details.price,image:getImage(),stockStatus:stockStatus,
      link:String(location.href||'').split('#')[0],variants:variants,
      options:variantsToOptions(variants),size:selectedSize,color:selectedColor,
      __flipkartDebug:{version:2,scrapedPrice:details.price,priceSource:details.source,
        titleLine:index,
        productSection:index>=0?lines.slice(index, index+25):[],
        variants:variants,
        stockDebug:(function(){
          var result=[];
          var nodes=document.querySelectorAll(
            'div,span,p,strong,button'
          );

          for(var i=0;i<nodes.length;i++){
            var el=nodes[i];
            var t=nodeText(el);

            if(
              t.length>100 ||
              !/^(Selected Color:|Selected Colour:|Select Size|Selected Size:)/i.test(t)
            ) continue;

            if(!visible(el)) continue;

            var parent=el.parentElement;

            if(!parent) continue;

            result.push({
              label:t.slice(0,100),
              parentHTML:parent.outerHTML.slice(0,2500),
              nextHTML:parent.nextElementSibling
                ?parent.nextElementSibling.outerHTML.slice(0,3500)
                :'',
              grandparentHTML:parent.parentElement
                ?parent.parentElement.outerHTML.slice(0,5000)
                :''
            });

            if(result.length>=4) break;
          }

          return result;
        })(),
        priceFromSection:priceFromSection(lines,getTitle()),
        priceFromDOM:priceFromDOM(getTitle()),
        visiblePriceNodes:Array.prototype.slice.call(
          document.querySelectorAll(
            ".Nx9bqj,._30jeq3,._16Jk6d,[class*='Nx9bqj'],span,strong,b"
          )
        ).filter(function(el){
          return visible(el) && /₹\s*[\d,]+/.test(nodeText(el));
        }).slice(0,35).map(function(el){
          var r=el.getBoundingClientRect();
          return {
            text:nodeText(el).slice(0,100),
            cls:String(el.className||"").slice(0,100),
            top:Math.round(r.top),
            width:Math.round(r.width)
          };
        })
      }
    };
  }
  window.__miFlipkartAdapter={version:2,isFlipkart:hostOK,isProductPage:isProductPage,getTitle:getTitle,
    getPrice:getPrice,getImage:getImage,getVariants:getVariants,scrape:scrape};
  window.__miFlipkartAdapterInstalled=true;
})();
`;
