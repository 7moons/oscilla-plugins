// Alternative appearance for Oxitune (plugin API 1): two looks for YouTube
// Music. "glass" puts translucent glass over a blurred wash of the cover
// art and floats the player bar; "panels" lays the sidebar, the page and the
// now-playing view out as rounded panels on black. The stylesheets are
// scoped to attributes on <html> (data-oxa-look, data-oxa-floating), so they
// do nothing until this script sets them; per-track colors and the wash are
// custom properties in one style added with oxitune.ui.addStyle. Nothing here
// writes inline styles on YouTube Music's own (Polymer) elements.

var LOOKS = ['glass', 'panels'];
/** Font setting -> font-family; 'look' keeps the look's own (glass.css,
 * panels.css). The 'Oxa *' families are embedded by the font-*.css files. */
var FONTS = {
  inter: "'Oxa Inter'",
  figtree: "'Oxa Figtree'",
  geist: "'Oxa Geist'",
  manrope: "'Oxa Manrope'",
  'plus-jakarta-sans': "'Oxa Plus Jakarta Sans'",
  'dm-sans': "'Oxa DM Sans'",
  youtube: "'YouTube Sans', Roboto"
};
/** Accent when the cover has no usable color or tinting is off. */
var FIXED_ACCENT = { glass: '#5ad1e6', panels: '#1ed760' };
var FIXED_BASE = { glass: '#16242b', panels: '#1d1d1d' };
/** Header tint when the cover gives no color: the panels look's accent is
 * its green, which would flood a page header. */
var FIXED_TINT = { glass: '#5ad1e6', panels: '#5a5a5a' };
var WASH_SIZE = 48;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Settings as stored, checked again: an unknown look or a number out of
 * range falls back to the manifest default instead of breaking the CSS. */
function normalizeSettings(values) {
  var v = values || {};
  var radius = Number(v.radius);
  var backdrop = Number(v.backdrop);
  return {
    look: LOOKS.indexOf(v.look) >= 0 ? v.look : 'glass',
    font: FONTS.hasOwnProperty(v.font) ? v.font : 'look',
    tint: v.tint !== false,
    floating: v.floating_bar !== false,
    radius: isFinite(radius) && v.radius !== null && v.radius !== '' ? Math.round(clamp(radius, 0, 28)) : 12,
    backdrop: isFinite(backdrop) && v.backdrop !== null && v.backdrop !== '' ? Math.round(clamp(backdrop, 0, 100)) : 70
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var l = (max + min) / 2;
  var d = max - min;
  if (d === 0) return [0, 0, l];
  var s = d / (1 - Math.abs(2 * l - 1));
  var h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToHex(h, s, l) {
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = l - c / 2;
  var rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  var hex = '#';
  for (var i = 0; i < 3; i++) {
    var n = Math.round(clamp((rgb[i] + m) * 255, 0, 255));
    hex += (n < 16 ? '0' : '') + n.toString(16);
  }
  return hex;
}

/** Colors for the page from a cover's RGBA pixels: `accent`, the most
 * colorful hue family lifted to read on a dark background (null for a
 * black-and-white cover), and `base`, the cover's average darkened into a
 * background tint. Hue families are 30° wide and weighted by chroma, so a
 * small vivid area beats a large muddy one. */
function pickPalette(data) {
  var bins = [];
  for (var b = 0; b < 12; b++) bins.push({ score: 0, r: 0, g: 0, b: 0, n: 0 });
  var sumR = 0;
  var sumG = 0;
  var sumB = 0;
  var count = 0;
  for (var i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    var r = data[i];
    var g = data[i + 1];
    var bl = data[i + 2];
    sumR += r;
    sumG += g;
    sumB += bl;
    count++;
    var chroma = (Math.max(r, g, bl) - Math.min(r, g, bl)) / 255;
    if (chroma < 0.15) continue;
    var hsl = rgbToHsl(r, g, bl);
    if (hsl[2] < 0.08 || hsl[2] > 0.95) continue;
    var bin = bins[Math.floor(hsl[0] / 30) % 12];
    bin.score += chroma;
    bin.r += r;
    bin.g += g;
    bin.b += bl;
    bin.n++;
  }
  if (count === 0) return null;

  var avg = rgbToHsl(sumR / count, sumG / count, sumB / count);
  var base = hslToHex(avg[0], Math.min(avg[1], 0.45), clamp(avg[2] * 0.35, 0.07, 0.16));

  var best = null;
  for (var k = 0; k < 12; k++) if (bins[k].n > 0 && (!best || bins[k].score > best.score)) best = bins[k];
  // A few stray colored pixels on a grey cover are noise, not an accent.
  if (!best || best.n < Math.max(2, count * 0.03)) return { accent: null, base: base };
  var a = rgbToHsl(best.r / best.n, best.g / best.n, best.b / best.n);
  return { accent: hslToHex(a[0], clamp(a[1], 0.5, 0.9), clamp(a[2], 0.6, 0.72)), base: base };
}

/** Only a PNG data URL rendered by this plugin may go into the CSS. */
function isWashUrl(url) {
  return typeof url === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url);
}

/** Header color for the open page in the panels look. `page` is what the
 * page leads with: null for no artwork (home, search), else { palette },
 * where a null palette means the artwork couldn't be read. Artwork with a
 * color gives that color, black-and-white artwork neutral grey; without
 * readable artwork the header follows the playing song. */
function headColor(settings, songPalette, page) {
  var look = settings.look;
  if (!settings.tint) return FIXED_TINT[look];
  if (page && page.palette) return page.palette.accent || FIXED_TINT[look];
  return (songPalette && songPalette.accent) || FIXED_TINT[look];
}

/** The artwork the open page leads with: an artist's photo, or an album's
 * or playlist's cover. null on pages without one. */
var HEADER_ART = [
  'ytmusic-browse-response#browse-page ytmusic-immersive-header-renderer ytmusic-fullbleed-thumbnail-renderer img',
  'ytmusic-browse-response#browse-page ytmusic-responsive-header-renderer ytmusic-thumbnail-renderer img'
];
function pageArtUrl(doc) {
  for (var i = 0; i < HEADER_ART.length; i++) {
    var img = doc.querySelector(HEADER_ART[i]);
    var src = img && (img.currentSrc || img.src);
    if (src && src.indexOf('https://') === 0) return src;
  }
  return null;
}

/** The per-track custom properties, scoped to the active look. */
function varsCss(settings, palette, washUrl, page) {
  var look = settings.look;
  var accent = (settings.tint && palette && palette.accent) || FIXED_ACCENT[look];
  var base = (settings.tint && palette && palette.base) || FIXED_BASE[look];
  var tint = (settings.tint && palette && palette.accent) || FIXED_TINT[look];
  var wash = settings.tint && isWashUrl(washUrl) ? 'url("' + washUrl + '")' : 'none';
  return (
    'html[data-oxa-look="' + look + '"] {' +
    ' --oxa-accent: ' + accent + ';' +
    ' --oxa-base: ' + base + ';' +
    ' --oxa-tint: ' + tint + ';' +
    ' --oxa-head: ' + headColor(settings, palette, page) + ';' +
    ' --oxa-radius: ' + settings.radius + 'px;' +
    ' --oxa-wash: ' + wash + ';' +
    ' --oxa-wash-opacity: ' + settings.backdrop / 100 + ';' +
    (settings.font !== 'look' ? ' --oxa-font: ' + FONTS[settings.font] + ', system-ui, sans-serif !important;' : '') +
    ' }'
  );
}

/** The attributes the stylesheets key on. */
function rootAttributes(settings) {
  return {
    'data-oxa-look': settings.look,
    'data-oxa-floating': settings.look === 'glass' && settings.floating ? 'true' : null
  };
}

/** One horizontal + vertical box-blur pass over RGBA pixels, in place;
 * three passes approximate a gaussian. WebKit has no canvas `filter`. */
function boxBlur(data, w, h, r) {
  var tmp = new Float32Array(data.length);
  function pass(src, dst, horizontal) {
    var lines = horizontal ? h : w;
    var len = horizontal ? w : h;
    for (var line = 0; line < lines; line++) {
      for (var c = 0; c < 4; c++) {
        for (var i = 0; i < len; i++) {
          var sum = 0;
          var n = 0;
          for (var k = Math.max(0, i - r); k <= Math.min(len - 1, i + r); k++) {
            sum += src[horizontal ? (line * w + k) * 4 + c : (k * w + line) * 4 + c];
            n++;
          }
          dst[horizontal ? (line * w + i) * 4 + c : (i * w + line) * 4 + c] = sum / n;
        }
      }
    }
  }
  pass(data, tmp, true);
  pass(tmp, data, false);
}

/** Pushes saturation and pulls brightness, in place, so the wash reads as
 * the cover's color behind white text instead of a grey smear. */
function gradeWash(data, saturate, brightness) {
  for (var i = 0; i < data.length; i += 4) {
    var lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    for (var c = 0; c < 3; c++) data[i + c] = clamp((lum + (data[i + c] - lum) * saturate) * brightness, 0, 255);
  }
}

/** Loads the cover once into a small canvas: its palette and a pre-blurred
 * wash (a data URL) the stylesheet stretches over the window. A live CSS
 * blur on a full-window layer would be recomposited on every repaint. */
function renderCover(doc, url, withWash) {
  return new Promise(function (resolve) {
    if (!url) return resolve(null);
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var canvas = doc.createElement('canvas');
        canvas.width = WASH_SIZE;
        canvas.height = WASH_SIZE;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, WASH_SIZE, WASH_SIZE);
        var pixels = ctx.getImageData(0, 0, WASH_SIZE, WASH_SIZE);
        var palette = pickPalette(pixels.data);
        if (withWash === false) return resolve({ palette: palette, wash: null });
        for (var i = 0; i < 3; i++) boxBlur(pixels.data, WASH_SIZE, WASH_SIZE, 3);
        gradeWash(pixels.data, 1.8, 0.62);
        ctx.putImageData(pixels, 0, 0);
        resolve({ palette: palette, wash: canvas.toDataURL('image/png') });
      } catch (e) {
        // A cover served without CORS taints the canvas.
        resolve(null);
      }
    };
    img.onerror = function () {
      resolve(null);
    };
    img.src = url;
  });
}

/** "m:ss", or "h:mm:ss" from an hour; "0:00" for anything unusable. */
function formatTime(secs) {
  var t = Math.floor(Number(secs));
  if (!isFinite(t) || t < 0) t = 0;
  var h = Math.floor(t / 3600);
  var m = Math.floor((t % 3600) / 60);
  var sec = t % 60;
  var ss = (sec < 10 ? '0' : '') + sec;
  if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
  return m + ':' + ss;
}

/** Elapsed and total time as two labels on either side of the progress
 * line. YouTube Music writes them as one string ("0:14 / 3:22") that CSS
 * can't split; these are the plugin's own elements in the bar's grid
 * (areas "elapsed" and "total"), and YouTube Music's string is hidden. */
function createTimeLabels(doc, player) {
  var elapsed = doc.createElement('span');
  var total = doc.createElement('span');
  elapsed.className = 'oxa-time oxa-time-elapsed';
  total.className = 'oxa-time oxa-time-total';
  elapsed.setAttribute('aria-hidden', 'true');
  total.setAttribute('aria-hidden', 'true');
  var shown = { e: null, t: null };

  function attach() {
    var bar = doc.querySelector('ytmusic-player-bar');
    if (!bar) return false;
    if (elapsed.parentNode !== bar) bar.appendChild(elapsed);
    if (total.parentNode !== bar) bar.appendChild(total);
    return true;
  }

  function show(position, duration) {
    if (!attach()) return;
    var e = formatTime(position);
    var t = formatTime(duration);
    if (e !== shown.e) elapsed.textContent = shown.e = e;
    if (t !== shown.t) total.textContent = shown.t = t;
  }

  function refresh() {
    var track = player.getTrack();
    if (track) show(track.currentTimeSecs, track.durationSecs);
  }

  return {
    refresh: refresh,
    tick: function (position) {
      var track = player.getTrack();
      show(position, track ? track.durationSecs : 0);
    },
    remove: function () {
      if (elapsed.parentNode) elapsed.parentNode.removeChild(elapsed);
      if (total.parentNode) total.parentNode.removeChild(total);
    }
  };
}

function start(oxitune) {
  var doc = oxitune.page.document;
  var root = doc.documentElement;
  var settings = normalizeSettings(oxitune.settings.all());
  var cover = null;
  var coverUrl;
  var removeVars = null;
  var page = null;
  var pageUrl = null;
  var pageTimer = null;

  function applyAttributes() {
    var attrs = rootAttributes(settings);
    for (var name in attrs) {
      if (attrs[name] === null) root.removeAttribute(name);
      else root.setAttribute(name, attrs[name]);
    }
  }

  function applyVars() {
    var remove = removeVars;
    removeVars = oxitune.ui.addStyle(varsCss(settings, cover && cover.palette, cover && cover.wash, page));
    if (remove) remove();
  }

  function onTrack(track) {
    var url = (track && track.coverUrl) || null;
    if (url === coverUrl) return;
    coverUrl = url;
    renderCover(doc, url).then(function (result) {
      // A newer song may have started while this cover was loading.
      if (url !== coverUrl) return;
      cover = result;
      applyVars();
    });
  }

  // YouTube Music swaps pages without an event a plugin can rely on, so the
  // panels look checks the open page's header artwork twice a second (one
  // querySelector per selector; the artwork is only loaded when it changes).
  function checkPage() {
    var url = pageArtUrl(doc);
    if (url === pageUrl) return;
    pageUrl = url;
    if (!url) {
      page = null;
      applyVars();
      return;
    }
    renderCover(doc, url, false).then(function (result) {
      if (url !== pageUrl) return;
      page = { palette: result && result.palette };
      applyVars();
    });
  }

  function watchPage() {
    var on = settings.look === 'panels' && settings.tint;
    if (on && !pageTimer) pageTimer = setInterval(checkPage, 500);
    if (!on && pageTimer) {
      clearInterval(pageTimer);
      pageTimer = null;
      page = null;
      pageUrl = null;
    }
  }

  applyAttributes();
  applyVars();
  watchPage();
  onTrack(oxitune.player.getTrack());
  oxitune.player.onTrackChange(onTrack);

  // onTick only fires while playing; the interval covers seeking while
  // paused and a new song's duration arriving after the track change.
  var times = createTimeLabels(doc, oxitune.player);
  times.refresh();
  oxitune.player.onTick(times.tick);
  oxitune.player.onTrackChange(times.refresh);
  var timesTimer = setInterval(times.refresh, 1000);
  oxitune.settings.onChange(function (values) {
    settings = normalizeSettings(values);
    applyAttributes();
    watchPage();
    applyVars();
  });
  oxitune.onUnload(function () {
    clearInterval(timesTimer);
    times.remove();
    if (pageTimer) clearInterval(pageTimer);
    if (removeVars) removeVars();
    root.removeAttribute('data-oxa-look');
    root.removeAttribute('data-oxa-floating');
  });
}

if (typeof oxitune !== 'undefined') {
  start(oxitune);
}

if (typeof module !== 'undefined') {
  module.exports = {
    formatTime: formatTime,
    normalizeSettings: normalizeSettings,
    pickPalette: pickPalette,
    rgbToHsl: rgbToHsl,
    hslToHex: hslToHex,
    isWashUrl: isWashUrl,
    varsCss: varsCss,
    headColor: headColor,
    pageArtUrl: pageArtUrl,
    rootAttributes: rootAttributes,
    boxBlur: boxBlur,
    gradeWash: gradeWash
  };
}
