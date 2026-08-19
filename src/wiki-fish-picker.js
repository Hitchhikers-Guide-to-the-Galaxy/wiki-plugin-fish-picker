/*
 * wiki-fish-picker.js — the site identity flag editor (owner only): a parametric
 * Mice & Fish favicon picker that writes the chosen flag into status/favicon.png
 * with the choice recorded in a PNG tEXt chunk. Extracted from wiki-plugin-
 * hitchhiker's wiki-ux.js (August 2026). Exposes window.plugins.fishPicker so the
 * hitchhiker Tools page can offer a button when — and only when — this is loaded.
 */
;(function () {
  'use strict'

  // ---- boot: wait for the client surface, then install once -----------------
  var installed = false
  var tries = 0
  var timer = setInterval(function () {
    tries++
    var ready =
      window.wiki &&
      window.plugins &&
      window.plugins.factory &&
      window.plugins.factory.bind &&
      window.$ &&
      typeof window.wiki.pageHandler !== 'undefined'
    if (ready && !installed) {
      installed = true
      clearInterval(timer)
      try {
        install()
      } catch (e) {
        console.error('[wiki-fish-picker] install failed', e)
      }
    } else if (tries > 100) {
      clearInterval(timer) // ~20s; give up quietly
    }
  }, 200)

  // ---- constants ----
  var BTN = 'font-size:1.05em;min-height:44px;padding:10px 18px;cursor:pointer;'

  function install() {
    installFishFlag()
    window.plugins.fishPicker = { open: openFishPicker }
    console.log('[wiki-fish-picker] installed')
  }

  // 5. Fish Picker — the site identity flag editor (owner only)
  // ===========================================================================
  function installFishFlag() {
    if (document.getElementById('fish-picker-gen')) return
    var s = document.createElement('script')
    s.id = 'fish-picker-gen'
    s.src = '/plugins/hitchhiker/fish.js' // sets window.FishPicker
    document.head.appendChild(s)
    // Bridge: an embedded (sandboxed, session-less) Fish Picker frame asks us —
    // the authenticated page — to persist its favicon. The POST is owner-gated
    // server-side, so relaying is safe; we just carry the session cookie.
    window.addEventListener('message', function (e) {
      var d = e.data
      if (!d || d.type !== 'fishpicker:save' || typeof d.image !== 'string' || d.image.slice(0, 10) !== 'data:image') return
      var reply = function (ok, status) {
        try { e.source && e.source.postMessage({ type: 'fishpicker:saved', ok: ok, status: status }, '*') } catch (_) {}
      }
      fetch('/favicon.png', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: d.image }),
      })
        .then(function (r) { if (r.ok) bustFavicon(); reply(r.ok, r.status) })
        .catch(function () { reply(false, 0) })
    })
  }

  // Open the Fish Picker for THIS site's flag. Seeds from /status/identity.json
  // if present, else from the {person}.{topic} domain.
  function openFishPicker($src, $tools) {
    var FP = window.FishPicker
    if (!FP) return window.alert('Fish Picker still loading — try again in a moment.')
    var host = location.hostname
    var labels = host.split('.').filter(Boolean)
    var st = { id: labels[0] || 'owner', name: labels[0] || '', type: 'human', topic: labels[1] || 'fish', species: FP.speciesFor(labels[0] || ''), variant: 3 }
    var SPECIES = ['koi', 'pufferfish', 'pike']
    var opt = function (arr, sel) {
      return arr.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + x + '</option>' }).join('')
    }
    var identity = function () {
      return { name: st.name, id: st.type === 'agent' ? st.id + '-agent' : st.id, type: st.type, topicGroup: st.topic, species: st.species, variant: st.variant, publicKey: null }
    }
    var dlg = document.createElement('dialog')
    dlg.id = 'fish-picker-dialog'
    dlg.style.cssText = 'max-width:520px;border:1px solid #ccc;border-radius:10px;padding:0'
    dlg.innerHTML =
      '<form method="dialog" style="margin:0;padding:16px 18px;font:14px system-ui,sans-serif">' +
      '<h2 style="margin:0 0 8px;font-size:16px">🐟 Site flag — ' + esc(host) + '</h2>' +
      '<div id="fp-preview" style="display:flex;gap:10px;align-items:flex-end;min-height:132px;margin:6px 0"></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">' +
      '<label>Species <select id="fp-species">' + opt(SPECIES, st.species) + '</select></label>' +
      '<label>School <select id="fp-topic">' + opt(Object.keys(FP.SCHOOLS), st.topic) + '</select></label>' +
      '<label><input type="checkbox" id="fp-agent"> Agent (AI)</label>' +
      '<label>Variant <button type="button" id="fp-vd">−</button> <span id="fp-v">' + st.variant + '</span> <button type="button" id="fp-vu">+</button></label>' +
      '</div>' +
      '<pre id="fp-json" style="background:#f6f5f2;border-radius:6px;padding:8px;font-size:11px;max-height:120px;overflow:auto;margin:8px 0"></pre>' +
      '<menu style="display:flex;gap:8px;justify-content:flex-end;padding:0;margin:6px 0 0">' +
      '<button value="cancel">Cancel</button><button value="save" style="' + BTN + '">Save flag</button></menu>' +
      '</form>'
    document.body.appendChild(dlg)
    var render = function () {
      dlg.querySelector('#fp-preview').innerHTML = FP.fishSVG(st, 32) + FP.fishSVG(st, 64) + FP.fishSVG(st, 128)
      dlg.querySelector('#fp-json').textContent = JSON.stringify(identity(), null, 1)
    }
    dlg.querySelector('#fp-species').onchange = function () { st.species = this.value; render() }
    dlg.querySelector('#fp-topic').onchange = function () { st.topic = this.value; render() }
    dlg.querySelector('#fp-agent').onchange = function () { st.type = this.checked ? 'agent' : 'human'; render() }
    dlg.querySelector('#fp-vu').onclick = function () { st.variant++; dlg.querySelector('#fp-v').textContent = st.variant; render() }
    dlg.querySelector('#fp-vd').onclick = function () { st.variant = Math.max(0, st.variant - 1); dlg.querySelector('#fp-v').textContent = st.variant; render() }
    dlg.addEventListener('close', function () {
      if (dlg.returnValue === 'save') saveFishFlag(st)
      dlg.remove()
      if ($tools) $tools.remove()
    })
    var seed = function (id) {
      if (id) {
        st.id = (id.id || st.id).replace(/-agent$/, '') // stored agent id is base+"-agent"
        st.name = id.name || st.name
        st.type = id.type || st.type
        st.topic = id.topicGroup || st.topic
        st.species = id.species || st.species
        if (id.variant != null) st.variant = id.variant
        dlg.querySelector('#fp-species').value = st.species
        dlg.querySelector('#fp-topic').value = st.topic
        dlg.querySelector('#fp-agent').checked = st.type === 'agent'
        dlg.querySelector('#fp-v').textContent = st.variant
      }
      render()
    }
    // seed from the current favicon's embedded identity, else /status/identity.json, else domain
    fetch('/favicon.png?t=' + Date.now())
      .then(function (r) { return r.ok ? r.arrayBuffer() : null })
      .then(function (ab) {
        if (ab) {
          var txt = pngReadText(new Uint8Array(ab), 'fishpicker')
          if (txt) {
            try {
              return JSON.parse(decodeURIComponent(txt))
            } catch (e) {}
          }
        }
        return fetch('/status/identity.json')
          .then(function (r) { return r.ok ? r.json() : null })
          .catch(function () { return null })
      })
      .then(seed)
      .catch(function () { seed(null) })
    render()
    dlg.showModal()
  }

  // v1.5b: persist the flag by POSTing the favicon to fedwiki's built-in,
  // owner-gated  POST /favicon.png  — reusing the farm's own security
  // (securityhandler.isAuthorized), so NO new route and NO new auth. The identity
  // record rides along in a PNG tEXt chunk ("fishpicker"), so the favicon is
  // self-describing and the picker re-seeds from it — no identity.json file needed.
  function saveFishFlag(st) {
    var FP = window.FishPicker
    var identity = { name: st.name, id: st.type === 'agent' ? st.id + '-agent' : st.id, type: st.type, topicGroup: st.topic, species: st.species, variant: st.variant, publicKey: null }
    var svg = FP.fishSVG(st, 128)
    var img = new Image()
    img.onload = function () {
      var cv = document.createElement('canvas')
      cv.width = cv.height = 64
      cv.getContext('2d').drawImage(img, 0, 0, 64, 64)
      cv.toBlob(function (blob) {
        blob.arrayBuffer().then(function (ab) {
          var png = pngInsertText(new Uint8Array(ab), 'fishpicker', encodeURIComponent(JSON.stringify(identity)))
          fetch('/favicon.png', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: 'data:image/png;base64,' + b64(png) }),
          })
            .then(function (r) {
              if (r.ok) {
                bustFavicon()
                window.alert('🐟 Flag saved to ' + location.hostname + '.')
              } else if (r.status === 403) {
                window.alert('Not saved — you must be signed in as the owner of this site.')
              } else {
                window.alert('Save failed (HTTP ' + r.status + ').')
              }
            })
            .catch(function (e) { window.alert('Save failed: ' + (e && e.message)) })
        })
      }, 'image/png')
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
  }

  // Refresh the favicon in every page header (cache-bust) after a save.
  function bustFavicon() {
    try {
      var imgs = document.querySelectorAll('img.favicon')
      for (var i = 0; i < imgs.length; i++) imgs[i].src = '/favicon.png?t=' + Date.now()
    } catch (e) {}
  }

  // ---- PNG tEXt chunk helpers — insert/read a keyword=text metadata chunk ----
  var CRC_TABLE = (function () {
    var t = [], c, n, k
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
    return t
  })()
  function crc32(bytes) {
    var c = 0xffffffff
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255] }
  function pngInsertText(png, keyword, text) {
    var data = []
    for (var i = 0; i < keyword.length; i++) data.push(keyword.charCodeAt(i) & 255)
    data.push(0)
    for (var j = 0; j < text.length; j++) data.push(text.charCodeAt(j) & 255)
    var body = [0x74, 0x45, 0x58, 0x74].concat(data) // 'tEXt' + data
    var chunk = u32(data.length).concat(body).concat(u32(crc32(new Uint8Array(body))))
    var iend = png.length - 12 // IEND is the final 12 bytes; insert before it
    var out = new Uint8Array(png.length + chunk.length)
    out.set(png.subarray(0, iend), 0)
    out.set(new Uint8Array(chunk), iend)
    out.set(png.subarray(iend), iend + chunk.length)
    return out
  }
  function pngReadText(png, keyword) {
    var p = 8
    while (p + 8 <= png.length) {
      var len = (png[p] << 24) | (png[p + 1] << 16) | (png[p + 2] << 8) | png[p + 3]
      var type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7])
      if (type === 'tEXt') {
        var s = ''
        for (var i = 0; i < len; i++) s += String.fromCharCode(png[p + 8 + i])
        var z = s.indexOf('\0')
        if (z !== -1 && s.slice(0, z) === keyword) return s.slice(z + 1)
      }
      if (type === 'IEND') break
      p += 12 + len
    }
    return null
  }
  function b64(bytes) {
    var s = ''
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    return btoa(s)
  }

  // ===========================================================================

  // ---- helpers ----
  function esc(s) {
    return ('' + (s == null ? '' : s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
})()
