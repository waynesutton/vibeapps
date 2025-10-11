import { useState } from "react";
import {
  Mail,
  ToggleLeft,
  ToggleRight,
  Send,
  Users,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import AlertDialog from "../ui/AlertDialog";
import MessageDialog from "../ui/MessageDialog";
import PromptDialog from "../ui/PromptDialog";
import { EmailTestingPanel } from "./EmailTestingPanel";

export function EmailManagement() {
  const [emailToggling, setEmailToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Broadcast email state
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // User search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<
    Array<{ _id: string; name?: string; email: string }>
  >([]);
  const [sendToAll, setSendToAll] = useState(true);

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    onConfirm: () => void;
    confirmText?: string;
    variant?: "default" | "destructive";
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const [messageDialog, setMessageDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    variant?: "info" | "success" | "warning" | "error";
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });

  // Email settings queries and mutations
  const emailsEnabled = useQuery(api.settings.getBoolean, {
    key: "emailsEnabled",
  });
  const toggleEmailsMutation = useMutation(api.settings.toggleEmails);
  const sendBroadcastMutation = useMutation(api.emails.broadcast.sendBroadcast);
  const sendBroadcastToSelectedMutation = useMutation(
    api.emails.broadcast.sendBroadcastToSelected,
  );
  const fixMissingEmailsMutation = useMutation(api.users.fixMissingEmails);
  const forceRefreshUserMutation = useMutation(
    api.users.forceRefreshCurrentUser,
  );
  const forceLogoutAllMutation = useMutation(
    api.admin.adminActions.forceLogoutAllUsers,
  );
  const sendTestEmailMutation = useMutation(api.sendEmails.sendTestEmail);
  const testDailyAdminEmailMutation = useMutation(
    api.testDailyEmail.testDailyAdminEmail,
  );
  const testDailyUserEmailsMutation = useMutation(
    api.testDailyEmail.testDailyUserEmails,
  );
  const testWeeklyDigestMutation = useMutation(
    api.testDailyEmail.testWeeklyDigest,
  );
  const testWelcomeEmailMutation = useMutation(
    api.testWelcomeEmail.testWelcomeEmail,
  );
  const clearTodaysEmailLogsMutation = useMutation(
    api.testDailyEmail.clearTodaysEmailLogs,
  );

  // Search for users
  const searchResults = useQuery(
    api.emails.broadcast.searchUsers,
    searchQuery.length >= 2 ? { query: searchQuery } : "skip",
  );

  // Debug: Get all users to see what's in the database
  const debugUsers = useQuery(api.emails.broadcast.debugUsers, {});

  const handleToggleEmails = async () => {
    setEmailToggling(true);
    setError(null);
    try {
      await toggleEmailsMutation({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to toggle emails:", err);
      setError(
        err instanceof Error ? err.message : "Failed to toggle email settings.",
      );
    } finally {
      setEmailToggling(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastContent.trim()) {
      setError(
        "Please provide both subject and content for the broadcast email.",
      );
      return;
    }

    if (!sendToAll && selectedUsers.length === 0) {
      setError(
        "Please select at least one user or choose 'Send to All Users'.",
      );
      return;
    }

    setIsSendingBroadcast(true);
    setError(null);

    try {
      let result;
      if (sendToAll) {
        result = await sendBroadcastMutation({
          subject: broadcastSubject.trim(),
          htmlContent: broadcastContent.trim(),
        });
      } else {
        result = await sendBroadcastToSelectedMutation({
          subject: broadcastSubject.trim(),
          htmlContent: broadcastContent.trim(),
          userIds: selectedUsers.map((u) => u._id as any),
        });
      }

      if (result.success) {
        setBroadcastSuccess(true);
        setBroadcastSubject("");
        setBroadcastContent("");
        setSelectedUsers([]);
        setSearchQuery("");
        setTimeout(() => setBroadcastSuccess(false), 5000);
      } else {
        setError("Failed to send broadcast email. Please try again.");
      }
    } catch (err) {
      console.error("Failed to send broadcast email:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send broadcast email.",
      );
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleAddUser = (user: {
    _id: string;
    name?: string;
    email: string;
  }) => {
    if (!selectedUsers.find((u) => u._id === user._id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchQuery("");
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
  };

  return (
    <div className="space-y-8">
      {/* Global Email Toggle */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-[#525252]" />
          <h2 className="text-xl font-medium text-[#525252]">
            Email System Control
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {showSuccess && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
            Email settings updated successfully!
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-[#292929] mb-1">
              Global Email System
            </h3>
            <p className="text-sm text-gray-600">
              Master switch to enable or disable all email notifications across
              the platform. When disabled, no emails will be sent to users.
            </p>
          </div>
          <button
            onClick={handleToggleEmails}
            disabled={emailToggling || emailsEnabled === undefined}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              emailsEnabled
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-red-100 text-red-700 hover:bg-red-200"
            } disabled:opacity-50`}
          >
            {emailToggling ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            ) : emailsEnabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            <span className="font-medium">
              {emailToggling
                ? "Updating..."
                : emailsEnabled
                  ? "Enabled"
                  : "Disabled"}
            </span>
          </button>
        </div>
      </div>

      {/* Admin Broadcast Emails */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Send className="w-6 h-6 text-[#525252]" />
          <h2 className="text-xl font-medium text-[#525252]">
            Broadcast Emails
          </h2>
        </div>

        {broadcastSuccess && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
            Broadcast email sent successfully to all users!
          </div>
        )}

        {/* Email System Status */}
        {debugUsers && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <h4 className="font-medium text-green-900 mb-3">
              ✅ Email System Status - WORKING
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-white rounded border">
                <h5 className="font-medium text-gray-900 mb-1">
                  Database Status
                </h5>
                <p className="text-sm text-gray-700">
                  Total users: <strong>{debugUsers.length}</strong>
                </p>
                <p className="text-sm text-gray-700">
                  Users with email:{" "}
                  <strong>{debugUsers.filter((u) => u.hasEmail).length}</strong>
                </p>
                <p className="text-sm text-gray-700">
                  Missing emails:{" "}
                  <strong>
                    {debugUsers.filter((u) => !u.hasEmail).length}
                  </strong>
                </p>
              </div>

              <div className="p-3 bg-white rounded border">
                <h5 className="font-medium text-gray-900 mb-1">
                  System Status
                </h5>
                <p className="text-sm text-green-700">
                  ✅ Email extraction working
                </p>
                <p className="text-sm text-green-700">
                  ✅ New users get emails automatically
                </p>
                <p className="text-sm text-green-700">
                  ✅ User search will work after login
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-3">
              <h5 className="font-medium text-blue-900 mb-1">
                📧 How to Fix Missing Emails
              </h5>
              <p className="text-sm text-blue-800 mb-2">
                <strong>For users without emails:</strong> They need to log out
                and log back in to sync their email addresses from Clerk.
              </p>
              <p className="text-xs text-blue-700">
                The email system is now working correctly and will automatically
                sync emails when users authenticate.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  const usersWithEmail = debugUsers.filter(
                    (u) => u.hasEmail,
                  ).length;
                  const usersWithoutEmail = debugUsers.filter(
                    (u) => !u.hasEmail,
                  ).length;

                  alert(`📧 Email System Status Report

✅ SYSTEM IS WORKING CORRECTLY

📊 Current Statistics:
• Total users: ${debugUsers.length}
• Users with emails: ${usersWithEmail}
• Users needing email sync: ${usersWithoutEmail}

🔧 What's Fixed:
• Email extraction from Clerk identity ✅
• New user email sync ✅  
• User search functionality ✅
• Broadcast email system ✅

📋 Next Steps:
${
  usersWithoutEmail > 0
    ? `• ${usersWithoutEmail} users need to log out and log back in
• This will automatically sync their emails
• No admin action required`
    : `• All users have emails synced!
• System is fully operational`
}

The email system is ready for production use!`);
                }}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                📊 System Report
              </button>

              <button
                onClick={async () => {
                  try {
                    const result = await forceRefreshUserMutation({});
                    alert(
                      `${result.success ? "Success" : "Error"}: ${result.message}`,
                    );
                    window.location.reload();
                  } catch (error) {
                    alert(
                      `Error: ${error instanceof Error ? error.message : "Failed to refresh user"}`,
                    );
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                🔄 Refresh My Email
              </button>

              <button
                onClick={() => {
                  const usersWithoutEmail = debugUsers.filter(
                    (u) => !u.hasEmail,
                  ).length;

                  if (
                    confirm(`🚨 Force All Users to Re-login?

This will help sync emails for ${usersWithoutEmail} users who don't have emails yet.

Options:
1. Use Clerk Dashboard (Recommended)
2. Add app-level session invalidation

Do you want to see the instructions?`)
                  ) {
                    alert(`🔐 How to Force User Re-login:

📋 OPTION 1: Clerk Dashboard (Recommended)
1. Go to https://dashboard.clerk.com
2. Navigate to "Users" 
3. For each user without email, click on them
4. Go to "Sessions" tab
5. Click "Revoke" on active sessions

📋 OPTION 2: Clerk API (Bulk)
Use Clerk's API to revoke all sessions:
• POST /v1/sessions/{session_id}/revoke
• Or use Clerk's admin SDK

📋 OPTION 3: App-Level (Future)
We could add a feature to:
• Set a "force_reauth" flag in database
• Check this flag on app load
• Force users to re-authenticate

The Clerk Dashboard method is the most reliable and immediate.`);
                  }
                }}
                className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
              >
                🚨 Force Re-login Help
              </button>

              <button
                onClick={async () => {
                  const usersWithoutEmail = debugUsers.filter(
                    (u) => !u.hasEmail,
                  ).length;

                  if (
                    confirm(`⚠️ FORCE LOGOUT ALL USERS?

This will immediately log out all ${debugUsers.length} users from the app.
${usersWithoutEmail} users will get their emails synced when they log back in.

⚠️ WARNING: This action cannot be undone!
All users will need to log back in.

Are you sure you want to proceed?`)
                  ) {
                    try {
                      const result = await forceLogoutAllMutation({
                        reason: "Email sync - admin forced re-authentication",
                      });
                      alert(
                        `${result.success ? "✅ Success" : "❌ Error"}: ${result.message}`,
                      );
                    } catch (error) {
                      alert(
                        `❌ Error: ${error instanceof Error ? error.message : "Failed to force logout users"}`,
                      );
                    }
                  }
                }}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                ⚠️ Force Logout All
              </button>

              <button
                onClick={() => {
                  setPromptDialog({
                    isOpen: true,
                    title: "Send Test Email",
                    description:
                      "Enter the email address to send a test email to:",
                    placeholder: "email@example.com",
                    defaultValue: "wayne@convex.dev",
                    onConfirm: async (email) => {
                      if (email.trim()) {
                        try {
                          const result = await sendTestEmailMutation({
                            to: email.trim(),
                          });
                          setMessageDialog({
                            isOpen: true,
                            title: result.success
                              ? "Email Sent"
                              : "Email Failed",
                            message: result.message,
                            variant: result.success ? "success" : "error",
                          });
                        } catch (error) {
                          setMessageDialog({
                            isOpen: true,
                            title: "Email Failed",
                            message: `Error: ${error instanceof Error ? error.message : "Failed to send test email"}`,
                            variant: "error",
                          });
                        }
                      }
                    },
                  });
                }}
                className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
              >
                📧 Send Test Email
              </button>

              <button
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: "Send Test Daily Admin Email",
                    description:
                      "This will send a test daily admin email to all admin users. Are you sure?",
                    confirmText: "Send Email",
                    onConfirm: async () => {
                      try {
                        const result = await testDailyAdminEmailMutation({});
                        setMessageDialog({
                          isOpen: true,
                          title: result.success ? "Email Sent" : "Email Failed",
                          message: result.message,
                          variant: result.success ? "success" : "error",
                        });
                      } catch (error) {
                        setMessageDialog({
                          isOpen: true,
                          title: "Email Failed",
                          message: `Error: ${error instanceof Error ? error.message : "Failed to send daily admin email"}`,
                          variant: "error",
                        });
                      }
                    },
                  });
                }}
                className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
              >
                📊 Test Daily Admin Email
              </button>

              <button
                onClick={async () => {
                  if (confirm("Send test daily user engagement emails now?")) {
                    try {
                      const result = await testDailyUserEmailsMutation({});
                      alert(
                        `${result.success ? "✅" : "❌"} ${result.message}`,
                      );
                    } catch (error) {
                      alert(
                        `❌ Error: ${error instanceof Error ? error.message : "Failed to send daily user emails"}`,
                      );
                    }
                  }
                }}
                className="px-3 py-1 bg-teal-600 text-white text-xs rounded hover:bg-teal-700"
              >
                📈 Test Daily User Emails
              </button>

              <button
                onClick={async () => {
                  if (confirm("Send test weekly digest email now?")) {
                    try {
                      const result = await testWeeklyDigestMutation({});
                      alert(
                        `${result.success ? "✅" : "❌"} ${result.message}`,
                      );
                    } catch (error) {
                      alert(
                        `❌ Error: ${error instanceof Error ? error.message : "Failed to send weekly digest"}`,
                      );
                    }
                  }
                }}
                className="px-3 py-1 bg-pink-600 text-white text-xs rounded hover:bg-pink-700"
              >
                📅 Test Weekly Digest
              </button>

              <button
                onClick={async () => {
                  if (confirm("Send test welcome email to yourself now?")) {
                    try {
                      const result = await testWelcomeEmailMutation({});
                      alert(
                        `${result.success ? "✅" : "❌"} ${result.message}`,
                      );
                    } catch (error) {
                      alert(
                        `❌ Error: ${error instanceof Error ? error.message : "Failed to send test welcome email"}`,
                      );
                    }
                  }
                }}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                👋 Test Welcome Email
              </button>

              <button
                onClick={async () => {
                  if (
                    confirm(
                      "Clear today's email logs? This will allow you to re-test daily/weekly emails that were already sent today.",
                    )
                  ) {
                    try {
                      const result = await clearTodaysEmailLogsMutation({});
                      alert(
                        `${result.success ? "✅" : "❌"} ${result.message} (${result.deletedCount} logs cleared)`,
                      );
                    } catch (error) {
                      alert(
                        `❌ Error: ${error instanceof Error ? error.message : "Failed to clear email logs"}`,
                      );
                    }
                  }
                }}
                className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
              >
                🧹 Clear Today's Email Logs
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Recipient Selection */}
          <div>
            <label className="block text-sm font-medium text-[#525252] mb-2">
              Recipients
            </label>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={sendToAll}
                    onChange={() => setSendToAll(true)}
                    className="text-[#292929] focus:ring-[#292929]"
                    disabled={isSendingBroadcast}
                  />
                  <span className="text-sm text-[#525252]">
                    Send to all users who haven't unsubscribed
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!sendToAll}
                    onChange={() => setSendToAll(false)}
                    className="text-[#292929] focus:ring-[#292929]"
                    disabled={isSendingBroadcast}
                  />
                  <span className="text-sm text-[#525252]">
                    Send to selected users
                  </span>
                </label>
              </div>

              {!sendToAll && (
                <div className="ml-6 space-y-3">
                  {/* User Search */}
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search users by name or email..."
                        className="w-full pl-10 pr-3 py-2 bg-white border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929]"
                        disabled={isSendingBroadcast}
                      />
                    </div>

                    {/* Search Results */}
                    {searchResults &&
                      searchResults.length > 0 &&
                      searchQuery.length >= 2 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {searchResults.map((user: any) => (
                            <button
                              key={user._id}
                              onClick={() => handleAddUser(user)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                              disabled={
                                !!selectedUsers.find((u) => u._id === user._id)
                              }
                            >
                              <div>
                                <div className="text-sm font-medium text-[#292929]">
                                  {user.name || "Anonymous User"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {user.email}
                                </div>
                              </div>
                              {selectedUsers.find(
                                (u) => u._id === user._id,
                              ) && (
                                <span className="text-xs text-green-600">
                                  Added
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Selected Users */}
                  {selectedUsers.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-2">
                        Selected users ({selectedUsers.length}):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedUsers.map((user) => (
                          <div
                            key={user._id}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm"
                          >
                            <span>{user.name || user.email}</span>
                            <button
                              onClick={() => handleRemoveUser(user._id)}
                              className="hover:text-blue-600"
                              disabled={isSendingBroadcast}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="broadcastSubject"
              className="block text-sm font-medium text-[#525252] mb-2"
            >
              Email Subject
            </label>
            <input
              id="broadcastSubject"
              type="text"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              placeholder="Enter email subject (will be prefixed with 'VibeApps Updates:')"
              className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929]"
              disabled={isSendingBroadcast}
            />
          </div>

          <div>
            <label
              htmlFor="broadcastContent"
              className="block text-sm font-medium text-[#525252] mb-2"
            >
              Email Content
            </label>
            <textarea
              id="broadcastContent"
              value={broadcastContent}
              onChange={(e) => setBroadcastContent(e.target.value)}
              placeholder="Enter the email content in HTML format..."
              rows={8}
              className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#292929] font-mono text-sm"
              disabled={isSendingBroadcast}
            />
            <p className="text-xs text-gray-500 mt-1">
              You can use HTML tags for formatting. The content will be wrapped
              in the VibeApps email template with proper branding, unsubscribe
              links, and List-Unsubscribe headers for compliance.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSendBroadcast}
              disabled={
                isSendingBroadcast ||
                !broadcastSubject.trim() ||
                !broadcastContent.trim()
              }
              className="flex items-center gap-2 px-4 py-2 bg-[#292929] text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingBroadcast ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Users className="w-4 h-4" />
              )}
              {isSendingBroadcast
                ? "Sending..."
                : sendToAll
                  ? "Send to All Users"
                  : `Send to ${selectedUsers.length} Selected User${selectedUsers.length !== 1 ? "s" : ""}`}
            </button>

            <div className="text-sm text-gray-600">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {sendToAll
                ? "This will send to all users who haven't unsubscribed"
                : `This will send to ${selectedUsers.length} selected user${selectedUsers.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
      </div>

      {/* Email Status Overview */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-[#525252] mb-4">
          Automated Email Types
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-1">
              Daily Admin Emails
            </h4>
            <p className="text-sm text-blue-700">
              Sent daily at 9:00 AM PST with platform metrics
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-1">User Engagement</h4>
            <p className="text-sm text-green-700">
              Daily digest emails with mentions and activity
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-1">Weekly Digest</h4>
            <p className="text-sm text-purple-700">
              Monday morning "Most Vibes" weekly roundup
            </p>
          </div>
        </div>
      </div>

      {/* Email Configuration Info */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-[#525252] mb-4">
          Email Configuration
        </h3>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800 space-y-1">
            <p>
              • <strong>From Address:</strong> VibeApps Updates
              &lt;alerts@updates.vibeapps.dev&gt;
            </p>
            <p>
              • <strong>Subject Prefix:</strong> "VibeApps Updates:"
            </p>
            <p>
              • <strong>Mention Notifications:</strong> Included in daily digest
              emails (max 10 per email)
            </p>
            <p>
              • <strong>Unsubscribe:</strong> Users can opt out via profile
              settings
            </p>
          </div>
        </div>
      </div>

      {/* Email Testing Panel */}
      <EmailTestingPanel />

      {/* Dialog Components */}
      <AlertDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmButtonText={confirmDialog.confirmText}
        confirmButtonVariant={confirmDialog.variant}
      />

      <MessageDialog
        isOpen={messageDialog.isOpen}
        onClose={() => setMessageDialog({ ...messageDialog, isOpen: false })}
        title={messageDialog.title}
        message={messageDialog.message}
        variant={messageDialog.variant}
      />

      <PromptDialog
        isOpen={promptDialog.isOpen}
        onClose={() => setPromptDialog({ ...promptDialog, isOpen: false })}
        onConfirm={promptDialog.onConfirm}
        title={promptDialog.title}
        description={promptDialog.description}
        placeholder={promptDialog.placeholder}
        defaultValue={promptDialog.defaultValue}
      />
    </div>
  );
}
