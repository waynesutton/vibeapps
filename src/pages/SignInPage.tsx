import { SignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";
import { sanitizeRedirectPath } from "../lib/redirectPath";

export default function SignInPage() {
  const [searchParams] = useSearchParams();
  // Where to land after auth, e.g. a judging group submit form reached by QR.
  // Undefined when absent or unsafe, which keeps Clerk's default behavior.
  const returnTo = sanitizeRedirectPath(searchParams.get("redirect_url"));
  // Carry the destination across the sign-in / sign-up switch
  const signUpUrl = returnTo
    ? `/sign-up?redirect_url=${encodeURIComponent(returnTo)}`
    : "/sign-up";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "calc(100vh - 200px)",
      }}>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl={signUpUrl}
        forceRedirectUrl={returnTo}
        signUpForceRedirectUrl={returnTo}
      />
    </div>
  );
}
