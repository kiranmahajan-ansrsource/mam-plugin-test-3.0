# LTI 1.3 Integration Guide: Using ltijs with Brightspace LMS

> **Objective:** Demonstrate how to integrate a Node.js-based LTI 1.3 tool using `ltijs` with Brightspace LMS. The final result enables a static HTML UI to be launched via "Insert Stuff" using Deep Linking, hosted on Google Cloud Run {GCP} with MongoDB Atlas.

---

## 📦 Technology Stack

- **Backend:** Node.js (Express) with `ltijs`
- **Frontend:** HTML + Lit Components for Deep Linking UI
- **Database:** MongoDB Atlas
- **Deployment:** Dockerized app hosted on Google Cloud Run {GCP}
- **LMS Platform:** Brightspace (D2L) with LTI 1.3 Advantage enabled

---

## 1. Project Structure

```
mam-plugin-test-3.0/
├── public/
│   ├── index.html         # Launch success page
│   └── deeplink.html      # UI for Deep Linking (Insert Stuff)
├── index.js               # Main server with ltijs setup
├── .env                   # Configuration and secrets
├── Dockerfile             # Docker image definition
└── package.json
```

---

## 2. ltijs Setup and Code Explanation

### `index.js` (main server)

#### 2.1 Initialization

```js
LTI.setup(
  process.env.LTI_KEY,
  { url: process.env.MONGODB_URI },
  {
    appRoute: "/lti/launch",
    loginRoute: "/lti/login",
    keysetRoute: "/lti/keys",
    cookies: {
      secure: true,
      sameSite: "None",
    },
  }
);
```

- `LTI_KEY`: Encryption key for sessions and JWT
- `MONGODB_URI`: MongoDB Atlas connection URI
- Routes:

  - `/lti/launch` – handles LTI launches (student access)
  - `/lti/login` – handles OIDC login redirect
  - `/lti/keys` – exposes public JWKs for Brightspace to verify your tool's signature

#### 2.2 Platform Registration

```js
LTI.registerPlatform({
  url: process.env.PLATFORM_URL,
  clientId: process.env.CLIENT_ID,
  authenticationEndpoint: process.env.OIDC_AUTH_URL,
  accesstokenEndpoint: process.env.TOKEN_URL,
  authConfig: { method: "JWK_SET", key: process.env.KEYSET_URL },
});
```

Registers Brightspace as the LTI platform with all required endpoints and authentication configuration.

#### 2.3 Launch Handler

```js
LTI.onConnect((token, req, res) => {
  return res.sendFile(path.join(__dirname, "public/index.html"));
});
```

Handles standard LTI launches and serves a static HTML file.

#### 2.4 Deep Linking Handler

```js
LTI.onDeepLinking((token, req, res) => {
  return LTI.redirect(res, "/lti/deeplink", { newResource: true });
});
```

Handles Deep Linking requests from Brightspace Insert Stuff. Redirects to the deep-link UI.

#### 2.5 Deep Linking Submission

```js
LTI.app.post("/lti/deeplink", async (req, res) => {
  const selection = req.body.product;
  const items = [
    {
      type: "ltiResourceLink",
      title: selection,
      url: `${process.env.APP_URL}/lti/launch`,
      custom: { product: selection },
    },
  ];

  const form = await LTI.DeepLinking.createDeepLinkingForm(
    res.locals.token,
    items
  );
  return res.send(form);
});
```

Generates and sends a Deep Linking response back to Brightspace with the selected resource.

---

## 3. Static HTML Pages

### `public/index.html`

This page is shown on standard LTI launch (when a user clicks a deep-linked resource in Brightspace). It confirms a successful launch.

### `public/deeplink.html`

This is the Lit-based UI for Deep Linking ("Insert Stuff"). It lets users choose a resource and submit it back to Brightspace.

---

## 4. Dockerization

### Dockerfile

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV PORT=8080
CMD ["node", "index.js"]
```

### Build and Push

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/lti-tool
```

### Deploy to Cloud Run {GCP}

```bash
gcloud run deploy lti-tool \
  --image gcr.io/YOUR_PROJECT_ID/lti-tool \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="ENCRYPTION_KEY=...,..."
```

> ℹ️ Re-deploy using the same service name to preserve the existing Cloud URL.

---

## 5. Brightspace LMS Configuration

### 5.1 Tool Registration

Admin → Manage Extensibility → LTI Advantage → Register Tool (Standard)

- **OpenID Connect Login URL**: `https://<deployed-cloud-url>/lti/login`
- **Redirect URLs**: `https://<deployed-cloud-url>/lti/launch`
- **Keyset URL**: `https://<deployed-cloud-url>/lti/keys`
- **Extensions**: Check Deep Linking

### 5.2 Deployment

- After registration, Deploy the tool to specific Org Units (courses)

### 5.3 Add Link for Insert Stuff

- Admin → External Learning Tools → View Links → New Link

  - Name: `Insert Static Tool`
  - URL: `https://<deployed-cloud-url>/lti/launch`
  - Type: `Deep Linking (Insert Stuff)`

### 5.4 Using the Tool

- Go to any Content editor in Brightspace
- Use **Insert Stuff** → Select the Tool → Choose content → It inserts a launch link
- Clicking the inserted link triggers the `/lti/launch` route → renders `index.html`

---

