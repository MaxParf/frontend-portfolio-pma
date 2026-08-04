export const CMS_API_BASE_URL = globalThis.__CMS_LITE_CONFIG__?.apiBaseUrl ?? "http://127.0.0.1:5520/cms-api";

export class CmsApiError extends Error {
  constructor(status, code = "API_ERROR") { super(code); this.status = status; this.code = code; }
}

async function request(path, { token, method = "GET", body, formData } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  let response;
  try { response = await fetch(`${CMS_API_BASE_URL}/${path}`, { method, headers, body: body ? JSON.stringify(body) : formData, mode: "cors" }); }
  catch { throw new CmsApiError(0, "NETWORK_ERROR"); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new CmsApiError(response.status, payload.code);
  return payload;
}

export const login = (credentials) => request("login.php", { method: "POST", body: credentials });
export const logout = (token) => request("logout.php", { token, method: "POST" });
export const changePassword = (token, credentials) => request("change-password.php", { token, method: "POST", body: credentials });
export const loadPrivateState = (token) => request("load.php", { token });
export const savePrivateState = (token, formData) => request("save.php", { token, method: "POST", formData });
