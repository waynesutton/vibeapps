import { SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";
import { sanitizeRedirectPath } from "../lib/redirectPath";

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  // Where to land after auth, e.g. a judging group submit form reached by QR.
  // Undefined when absent or unsafe, which keeps Clerk's default behavior.
  const returnTo = sanitizeRedirectPath(searchParams.get("redirect_url"));
  // Carry the destination across the sign-up / sign-in switch
  const signInUrl = returnTo
    ? `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`
    : "/sign-in";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "calc(100vh - 200px)",
      }}>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl={signInUrl}
        forceRedirectUrl={returnTo}
        signInForceRedirectUrl={returnTo}
      />
    </div>
  );
}
