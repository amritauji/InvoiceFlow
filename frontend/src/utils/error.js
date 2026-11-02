// Normalize backend error payloads into a plain, render-safe string.
// Handles:
//   { error: { message: "..." } }        -> app errors
//   { detail: "..." }                    -> single-message errors
//   { detail: [{ loc, msg, type }, ...] }-> FastAPI 422 validation errors
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  if (!data) return fallback;

  if (data.error?.message) return String(data.error.message);

  if (Array.isArray(data.detail)) {
    const parts = data.detail
      .map((item) => {
        const loc = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body').join('.') : null;
        return loc ? `${loc}: ${item.msg}` : item.msg;
      })
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }

  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.message === 'string') return data.message;

  return fallback;
}

export default getErrorMessage;
