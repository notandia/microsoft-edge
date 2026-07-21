// content/sanitizer.js

/**
 * Normalizes page-derived reference snippets as plain text.
 *
 * Callers read these values from `textContent`, and the popup renders them with
 * `textContent` as well. They must never be passed to an HTML parser or an
 * `innerHTML` sink. Keeping this helper text-only removes the need to ship a
 * browser-side HTML sanitizer and its associated attack surface.
 */
window.sanitize = (textInput) => {
  return typeof textInput === 'string' ? textInput : '';
};
