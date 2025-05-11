import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Define a route for Clerk webhooks
// The path can be anything you choose, e.g., "/clerk-webhooks" or "/api/clerk"
// Make sure this path matches what you configure in the Clerk dashboard
http.route({
  path: "/clerk", // You can change this path
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get the signature and payload from the request
    const signature = request.headers.get("svix-signature");
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");

    if (!signature || !id || !timestamp) {
      return new Response("Webhook Error: Missing svix headers", {
        status: 400,
      });
    }

    const payloadString = await request.text(); // Read the raw body as text

    // Call an internal action to handle the webhook, passing headers and the raw payload
    // We pass the raw payload string because svix needs it for verification
    try {
      await ctx.runAction(internal.clerk.handleClerkWebhook, {
        headers: {
          svix_id: id,
          svix_timestamp: timestamp,
          svix_signature: signature,
        },
        payload: payloadString,
      });
      return new Response(null, { status: 200 });
    } catch (err: any) {
      console.error("Error processing Clerk webhook:", err.message);
      // It's good practice to return a 200 even on internal errors
      // to prevent Clerk from resending the webhook unnecessarily,
      // unless the error is due to a malformed request that Clerk should know about.
      // For signature verification errors, svix might throw, which will be caught here.
      // Depending on the error from svix, you might return a 400.
      if (err.message.includes("Webhook Error:")) {
        // Specific errors from our action
        return new Response(err.message, { status: 400 });
      }
      return new Response("Webhook processing failed", { status: 500 }); // Or 200 to ack receipt
    }
  }),
});

export default http;
