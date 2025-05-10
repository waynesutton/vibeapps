export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex", // This should match the Audience ('aud') claim in your Clerk JWT template
    },
  ],
};
