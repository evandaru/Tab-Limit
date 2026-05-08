export function isAllowedUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch (e) {
    return false;
  }
}

export function getHostname(urlStr) {
  try {
    const urlObj = new URL(urlStr);
    return ["http:", "https:"].includes(urlObj.protocol)
      ? urlObj.hostname.replace(/^www\./, "")
      : null;
  } catch (error) {
    return null;
  }
}
