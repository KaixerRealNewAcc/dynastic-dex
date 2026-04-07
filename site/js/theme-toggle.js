(function() {
	'use strict';

	var STORAGE_KEY = 'porydex-theme';

	function readStoredMode() {
		try {
			return window.localStorage.getItem(STORAGE_KEY);
		} catch (e) {
			return null;
		}
	}

	function writeStoredMode(mode) {
		try {
			window.localStorage.setItem(STORAGE_KEY, mode);
		} catch (e) {
			// localStorage may be disabled in some environments
		}
	}

	function getPreferredMode() {
		var stored = readStoredMode();
		if (stored === 'dark' || stored === 'light') {
			return stored;
		}
		return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
	}

	function updateButtonLabel() {
		var button = document.getElementById('theme-toggle');
		if (!button) return;

		var isDark = document.documentElement.classList.contains('theme-dark');
		button.textContent = isDark ? 'Light Mode' : 'Dark Mode';
		button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
	}

	function applyMode(mode) {
		var isDark = mode === 'dark';
		document.documentElement.classList.toggle('theme-dark', isDark);
		updateButtonLabel();
	}

	function toggleMode() {
		var isDark = document.documentElement.classList.contains('theme-dark');
		var nextMode = isDark ? 'light' : 'dark';
		applyMode(nextMode);
		writeStoredMode(nextMode);
	}

	function initThemeToggle() {
		applyMode(getPreferredMode());
		var button = document.getElementById('theme-toggle');
		if (button) {
			button.addEventListener('click', toggleMode);
		}
	}

	window.PorydexTheme = {
		setMode: function(mode) {
			if (mode !== 'light' && mode !== 'dark') return;
			applyMode(mode);
			writeStoredMode(mode);
		},
		toggle: toggleMode,
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initThemeToggle);
	} else {
		initThemeToggle();
	}
})();
