// OAuth PKCE utilities
function dec2hex(dec) {
  return ('0' + dec.toString(16)).slice(-2);
}

function verifier() {
  var array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
  let str = '';
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(v) {
  const hashed = await sha256(v);
  return base64urlencode(hashed);
}

// Check if instance supports PKCE
async function supportsPKCE(instanceURL) {
  if (!instanceURL) return false;
  try {
    const res = await fetch(
      `https://${instanceURL}/.well-known/oauth-authorization-server`,
    );
    if (!res.ok || res.status !== 200) return false;
    const json = await res.json();
    if (json.code_challenge_methods_supported?.includes('S256')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

// OAuth flow functions
const CLIENT_NAME = 'Celebi.social';
const WEBSITE = window.location.origin || 'http://localhost:8000';
const SCOPES = 'read write follow push';
const REDIRECT_URI = window.location.href.split('?')[0]; // Remove any query params

// Register app with Mastodon instance
async function registerApplication(instanceURL) {
  const registrationParams = new URLSearchParams({
    client_name: CLIENT_NAME,
    redirect_uris: REDIRECT_URI,
    scopes: SCOPES,
    website: WEBSITE,
  });

  const registrationResponse = await fetch(
    `https://${instanceURL}/api/v1/apps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: registrationParams.toString(),
    },
  );

  const registrationJSON = await registrationResponse.json();
  console.log({ registrationJSON });
  return registrationJSON;
}

// Generate PKCE authorization URL
async function getPKCEAuthorizationURL(instanceURL, client_id, forceLogin = false) {
  const codeVerifier = verifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    client_id,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  });
  if (forceLogin) params.append('force_login', true);
  const authorizationURL = `https://${instanceURL}/oauth/authorize?${params.toString()}`;
  return [authorizationURL, codeVerifier];
}

// Generate standard authorization URL (fallback)
async function getAuthorizationURL(instanceURL, client_id, forceLogin = false) {
  const authorizationParams = new URLSearchParams({
    client_id,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
  });
  if (forceLogin) authorizationParams.append('force_login', true);
  const authorizationURL = `https://${instanceURL}/oauth/authorize?${authorizationParams.toString()}`;
  return authorizationURL;
}

// Exchange authorization code for access token
async function getAccessToken(instanceURL, client_id, client_secret, code, code_verifier) {
  const params = new URLSearchParams({
    client_id,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
  });

  if (client_secret) {
    params.append('client_secret', client_secret);
  }
  if (code_verifier) {
    params.append('code_verifier', code_verifier);
  }

  const tokenResponse = await fetch(`https://${instanceURL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const tokenJSON = await tokenResponse.json();
  console.log({ tokenJSON });
  return tokenJSON;
}

// Simple storage helpers
const storage = {
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  get: (key) => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  remove: (key) => localStorage.removeItem(key),
};

// Session storage for temporary data
const sessionStorage = {
  set: (key, value) => window.sessionStorage.setItem(key, JSON.stringify(value)),
  get: (key) => {
    try {
      return JSON.parse(window.sessionStorage.getItem(key));
    } catch {
      return null;
    }
  },
  remove: (key) => window.sessionStorage.removeItem(key),
};

// Main OAuth handler
const oauth = {
  async loginToInstance(instanceURL) {
    if (!instanceURL) throw new Error('Instance URL required');

    // Normalize instance URL
    instanceURL = instanceURL
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .replace(/^@?[^@]+@/, '')
      .trim();

    storage.set('instanceURL', instanceURL);

    // Check for existing app registration
    let credentialApplication = storage.get(`app_${instanceURL}`);
    if (!credentialApplication || !credentialApplication.client_id) {
      credentialApplication = await registerApplication(instanceURL);
      storage.set(`app_${instanceURL}`, credentialApplication);
    }

    const { client_id, client_secret } = credentialApplication;

    // Check PKCE support
    const authPKCE = await supportsPKCE(instanceURL);
    console.log({ authPKCE });

    if (authPKCE) {
      const [url, verifier] = await getPKCEAuthorizationURL(instanceURL, client_id);
      sessionStorage.set('codeVerifier', verifier);
      window.location.href = url;
    } else {
      window.location.href = await getAuthorizationURL(instanceURL, client_id);
    }
  },

  async handleCallback() {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return null;

    // Clear code from URL
    window.history.replaceState({}, document.title, window.location.pathname);

    const instanceURL = storage.get('instanceURL');
    const credentialApplication = storage.get(`app_${instanceURL}`);
    const verifier = sessionStorage.get('codeVerifier');

    if (!credentialApplication) throw new Error('No app registration found');

    const { client_id, client_secret } = credentialApplication;

    const tokenData = await getAccessToken(
      instanceURL,
      client_id,
      client_secret,
      code,
      verifier
    );

    if (tokenData.access_token) {
      storage.set('accessToken', tokenData.access_token);
      storage.set('currentInstance', instanceURL);
      sessionStorage.remove('codeVerifier');
      return {
        instanceURL,
        accessToken: tokenData.access_token
      };
    }

    throw new Error('Failed to get access token');
  },

  isLoggedIn() {
    return !!storage.get('accessToken');
  },

  getCurrentInstance() {
    return storage.get('currentInstance');
  },

  getAccessToken() {
    return storage.get('accessToken');
  },

  logout() {
    storage.remove('accessToken');
    storage.remove('currentInstance');
    sessionStorage.remove('codeVerifier');
  }
};

// Make available globally
window.oauth = oauth;