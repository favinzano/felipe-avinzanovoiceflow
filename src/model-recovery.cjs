"use strict";

function isRetryableModelError(error) {
  const message = String(error?.message || error || "");
  return !/ENOSPC|no space left|espacio insuficiente|401|403|unauthorized|forbidden/i.test(message);
}

async function loadModelWithRetry(load, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 1);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 0);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { value: await load(attempt), attempts: attempt };
    } catch (error) {
      lastError = error;
      options.onFailure?.(error, attempt);
      if (attempt >= maxAttempts || !isRetryableModelError(error)) throw error;
      if (retryDelayMs) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError;
}

module.exports = { isRetryableModelError, loadModelWithRetry };
