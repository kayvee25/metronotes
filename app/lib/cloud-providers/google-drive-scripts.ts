'use client';

// Dynamic script loaders for Google Identity Services and Picker API
// Uses module-level promise deduplication (same pattern as pdf-loader.ts)

let gisPromise: Promise<void> | null = null;
let pickerPromise: Promise<void> | null = null;

export function loadGoogleIdentityServices(): Promise<void> {
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        reject(new Error('Failed to load Google Identity Services'));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

export function loadGooglePickerApi(): Promise<void> {
  if (!pickerPromise) {
    pickerPromise = new Promise<void>((resolve, reject) => {
      if (typeof google !== 'undefined' && google.picker) {
        resolve();
        return;
      }

      const loadPicker = () => {
        gapi.load('picker', () => resolve());
      };

      // Check if gapi is already loaded
      if (typeof gapi !== 'undefined') {
        loadPicker();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => loadPicker();
      script.onerror = () => {
        pickerPromise = null;
        reject(new Error('Failed to load Google Picker API'));
      };
      document.head.appendChild(script);
    });
  }
  return pickerPromise;
}
