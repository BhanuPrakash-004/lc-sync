/**
 * guide.js — External Controller for Standalone Guide Page
 * Handles copying SQL schema to clipboard safely under MV3 CSP policies.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('copySqlBtnGuide');
  const sqlBox  = document.getElementById('sqlCodeGuide');

  if (!copyBtn || !sqlBox) return;

  copyBtn.addEventListener('click', async () => {
    const codeText = sqlBox.textContent || sqlBox.innerText;

    if (!codeText) return;

    try {
      await navigator.clipboard.writeText(codeText.trim());
      copyBtn.innerText = '✓ SQL Script Copied!';
      copyBtn.style.color = '#22c55e';
      copyBtn.style.borderColor = 'rgba(34,197,94,0.4)';

      setTimeout(() => {
        copyBtn.innerText = '📋 Copy Complete SQL Script (supabase/schema.sql)';
        copyBtn.style.color = '';
        copyBtn.style.borderColor = '';
      }, 2500);
    } catch (err) {
      // Fallback range selection copy
      const range = document.createRange();
      range.selectNode(sqlBox);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();

      copyBtn.innerText = '✓ Copied!';
      setTimeout(() => {
        copyBtn.innerText = '📋 Copy Complete SQL Script (supabase/schema.sql)';
      }, 2500);
    }
  });
});
