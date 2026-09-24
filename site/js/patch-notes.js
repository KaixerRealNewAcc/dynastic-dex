(function () {
  "use strict";

  var STORAGE_KEY = "astraldex-last-seen-patch";
  var modal = document.getElementById("patchNotesModal");
  var content = document.getElementById("patchNotesContent");
  var openButton = document.getElementById("patchNotesOpen");
  var closeButton = document.getElementById("patchNotesClose");
  var patches = getPatches();
  var latestPatch = patches.length ? patches[0] : null;
  var latestPatchVersion = latestPatch && latestPatch.version ? String(latestPatch.version) : "";
  var hasShownUpdatePrompt = false;
  var hasPendingRemoteUpdate = false;
  var updateCheckTimer = null;
  var UPDATE_CHECK_INITIAL_DELAY_MS = 10000;
  var UPDATE_CHECK_INTERVAL_MS = 30000;

  if (!modal || !content || !openButton || !closeButton) return;

  if (patches.length) {
    renderPatchList(patches);
  } else {
    content.innerHTML = '<p class="patchnotes-empty">No patch notes yet.</p>';
  }

  openButton.addEventListener("click", function () {
    openModal();
  });

  closeButton.addEventListener("click", function () {
    closeModal(true);
  });

  var closeTargets = modal.querySelectorAll("[data-patchnotes-close]");
  for (var i = 0; i < closeTargets.length; i++) {
    closeTargets[i].addEventListener("click", function () {
      closeModal(true);
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen()) {
      closeModal(true);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    maybeShowPendingUpdatePrompt();
  });

  if (latestPatch && getSeenPatchVersion() !== latestPatch.version) {
    openModal();
  }

  if (window.fetch && latestPatchVersion) {
    window.setTimeout(function () {
      checkForRemoteUpdate();
      updateCheckTimer = window.setInterval(checkForRemoteUpdate, UPDATE_CHECK_INTERVAL_MS);
    }, UPDATE_CHECK_INITIAL_DELAY_MS);
  }

  function getPatches() {
    var notes = window.OoushiiDexPatchNotes;
    if (!notes || !notes.length) return [];
    return notes;
  }

  function getSeenPatchVersion() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return "";
    }
  }

  function markPatchAsSeen(version) {
    if (!version) return;
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch (err) {}
  }

  function isOpen() {
    return !modal.hasAttribute("hidden");
  }

  function openModal() {
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("patchnotes-open");
    closeButton.focus();
  }

  function closeModal(markSeen) {
    if (!isOpen()) return;
    modal.setAttribute("hidden", "hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("patchnotes-open");

    if (markSeen && latestPatch) {
      markPatchAsSeen(latestPatch.version);
    }
  }

  function renderPatchList(list) {
    var buf = '';
    for (var patchIndex = 0; patchIndex < list.length; patchIndex++) {
      var patch = list[patchIndex];
      if (!patch) continue;

      buf += '<details class="patchnotes-entry"' + (patchIndex === 0 ? ' open' : '') + '>';
      buf += '<summary class="patchnotes-summary">';
      buf += '<span class="patchnotes-summary-main">';
      buf += '<span class="patchnotes-version">' + escapeHTML(patch.version || "Unversioned Patch") + '</span>';
      if (patch.title) {
        buf += '<span class="patchnotes-title">' + escapeHTML(patch.title) + '</span>';
      }
      buf += '</span>';
      if (patch.date) {
        buf += '<span class="patchnotes-date">' + escapeHTML(patch.date) + '</span>';
      }
      buf += '</summary>';
      buf += '<div class="patchnotes-meta">';

      var sections = patch.sections || [];
      for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        if (!section) continue;
        var items = section.items || [];
        buf += '<section class="patchnotes-section">';
        buf += '<h3>' + escapeHTML(section.heading || "Changes") + '</h3>';
        if (!items.length) {
          buf += '<p class="patchnotes-empty">No items listed yet.</p>';
        } else {
          buf += "<ul>";
          for (var j = 0; j < items.length; j++) {
            var item = items[j];
            if (item && typeof item === "object" && item.url) {
              buf += '<li><a href="' + escapeHTML(item.url) + '" target="_blank" rel="noopener noreferrer">' +
                escapeHTML(item.text || item.url) + '</a></li>';
            } else {
              buf += '<li>' + escapeHTML(item) + '</li>';
            }
          }
          buf += "</ul>";
        }
        buf += "</section>";
      }

      buf += "</div>";
      buf += "</details>";
    }

    content.innerHTML = buf;
  }

  function checkForRemoteUpdate() {
    if (hasShownUpdatePrompt || hasPendingRemoteUpdate) return;
    fetch("/js/patch-notes-data.js?updateCheck=" + Date.now(), {cache: "no-store"})
      .then(function (response) {
        if (!response.ok) return "";
        return response.text();
      })
      .then(function (sourceText) {
        if (!sourceText) return;
        var remoteVersion = extractLatestPatchVersion(sourceText);
        if (!remoteVersion || remoteVersion === latestPatchVersion) return;
        hasPendingRemoteUpdate = true;
        if (updateCheckTimer) {
          window.clearInterval(updateCheckTimer);
          updateCheckTimer = null;
        }
        maybeShowPendingUpdatePrompt();
      })
      .catch(function () {});
  }

  function extractLatestPatchVersion(sourceText) {
    var match = /version\s*:\s*["']([^"']+)["']/.exec(String(sourceText || ""));
    return match && match[1] ? match[1] : "";
  }

  function maybeShowPendingUpdatePrompt() {
    if (!hasPendingRemoteUpdate || hasShownUpdatePrompt) return;
    if (document.hidden) return;
    hasShownUpdatePrompt = true;
    showUpdatePrompt();
  }

  function showUpdatePrompt() {
    if (document.getElementById("patchnotesUpdatePrompt")) return;
    var popup = document.createElement("div");
    popup.id = "patchnotesUpdatePrompt";
    popup.className = "patchnotes-update-popup";
    popup.innerHTML =
      '<div class="patchnotes-update-card" role="alertdialog" aria-live="assertive" aria-label="Update available">' +
        '<p class="patchnotes-update-text">There is an update available. Please refresh to get the latest version.</p>' +
        '<div class="patchnotes-update-actions">' +
          '<button type="button" class="button" data-update-refresh>Refresh</button>' +
          '<button type="button" class="button" data-update-later>Later</button>' +
        '</div>' +
      "</div>";
    document.body.appendChild(popup);

    var refreshButton = popup.querySelector("[data-update-refresh]");
    var laterButton = popup.querySelector("[data-update-later]");
    if (refreshButton) {
      refreshButton.addEventListener("click", function () {
        window.location.reload();
      });
    }
    if (laterButton) {
      laterButton.addEventListener("click", function () {
        popup.parentNode.removeChild(popup);
      });
    }
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
