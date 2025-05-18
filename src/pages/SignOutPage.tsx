import React, { useEffect } from "react";
import { useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom"; // Assuming react-router-dom is used

export default function SignOutPage() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    const performSignOut = async () => {
      try {
        await signOut();
        // Redirect to homepage after sign out
        navigate("/");
      } catch (error) {
        console.error("Error signing out:", error);
        // Handle error, maybe show a message or redirect to an error page
        // For now, just redirect to home even if there's an error
        navigate("/");
      }
    };

    performSignOut();
  }, [signOut, navigate]);

  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h2>Signing out...</h2>
      <p>You are being redirected.</p>
    </div>
  );
}
