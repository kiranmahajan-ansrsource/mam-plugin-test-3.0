const path = require("path");
const LTI = require("ltijs").Provider;

// Initialize Ltijs
LTI.setup(
  process.env.LTI_KEY,
  {
    url: process.env.MONGODB_URI,
  },
  {
    appRoute: "/lti/launch", // Main app route after launch
    loginRoute: "/lti/login", // OIDC login callback
    keysetRoute: "/lti/keys", // Public JWKs for this tool
    cookies: {
      secure: true, // Use secure cookies (Cloud Run is HTTPS)
      sameSite: "None",
    },
    devMode: false,
  }
);

// LTI launch callback: show hello page
LTI.onConnect((token, req, res) => {
  // Token info available in `token` (e.g. res.locals.token)
  console.log("⚠️onConnect Launch⚠️");
  return res.sendFile(path.join(__dirname, "public/index.html"));
});

// Deep Linking callback: redirect to our selection UI
LTI.onDeepLinking((token, req, res) => {
  // newResource=true indicates creating a new content item
  console.log("⚠️onDeepLinking Launch⚠️");
  return LTI.redirect(res, "/lti/deeplink", { newResource: true });
});

// Serve the deep-linking selection page (GET)
LTI.app.get("/lti/deeplink", (req, res) => {
  res.sendFile(path.join(__dirname, "public/deeplink.html"));
});

// Handle deep-link form submission (POST)
LTI.app.post("/lti/deeplink", async (req, res) => {
  const selection = req.body.product; // from the form
  // Build a DeepLinking item (type: LTI Resource Link)
  const items = [
    {
      type: "ltiResourceLink",
      title: selection,
      url: `${process.env.APP_URL}/lti/launch`,
      custom: { product: selection },
    },
  ];
  // Create and send the deep linking response form
  const form = await LTI.DeepLinking.createDeepLinkingForm(
    res.locals.token,
    items,
    {
      message: "Item added successfully!",
    }
  );
  return res.send(form); // Auto-submits back to Brightspace
});

// Start server and (optionally) register platform
const start = async () => {
  await LTI.deploy({ port: process.env.PORT || 8080 });
  // Register the platform (Brightspace) so Ltijs knows its endpoints
  await LTI.registerPlatform({
    url: process.env.PLATFORM_URL,
    name: "Brightspace",
    clientId: process.env.CLIENT_ID,
    authenticationEndpoint: process.env.AUTH_URL,
    accesstokenEndpoint: process.env.TOKEN_URL,
    authConfig: { method: "JWK_SET", key: process.env.KEYSET_URL },
  });
};
start();
