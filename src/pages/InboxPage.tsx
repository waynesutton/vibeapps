import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, ArrowLeft, Trash2, Inbox, MessageCircle } from "lucide-react";
import { WeeklyLeaderboard } from "../components/WeeklyLeaderboard";
import { RecentVibers } from "../components/RecentVibers";
import { TopCategoriesOfWeek } from "../components/TopCategoriesOfWeek";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";

export default function InboxPage() {
  const { user: authUser, isLoaded } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedConversationId = searchParams.get(
    "conversation",
  ) as Id<"dmConversations"> | null;

  // Queries
  const conversations = useQuery(
    api.dm.listConversations,
    isLoaded ? {} : "skip",
  );
  const messages = useQuery(
    api.dm.listMessages,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  );

  // Mutations
  const sendMessageMutation = useMutation(api.dm.sendMessage);
  const deleteConversationMutation = useMutation(api.dm.deleteConversation);
  const markConversationReadMutation = useMutation(api.dm.markConversationRead);
  const clearInboxMutation = useMutation(api.dm.clearInbox);

  // Local state
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearingInbox, setIsClearingInbox] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  // Scroll to bottom when conversation is selected
  useEffect(() => {
    if (selectedConversationId && messages) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });
      }, 100);
    }
  }, [selectedConversationId]);

  // Mark conversation as read when viewing
  useEffect(() => {
    if (selectedConversationId) {
      markConversationReadMutation({ conversationId: selectedConversationId });
    }
  }, [selectedConversationId]);

  // Handle message send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversationId || isSending) return;

    setIsSending(true);
    try {
      await sendMessageMutation({
        conversationId: selectedConversationId,
        content: messageInput.trim(),
      });
      setMessageInput("");
    } catch (error: any) {
      alert(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = async () => {
    if (!selectedConversationId || isDeleting) return;

    const confirmed = window.confirm(
      "Delete this conversation? Messages will be removed from your view.",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteConversationMutation({
        conversationId: selectedConversationId,
      });
      navigate("/inbox"); // Go back to conversation list
    } catch (error: any) {
      alert(error.message || "Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle clear inbox
  const handleClearInbox = async () => {
    const confirmed = window.confirm(
      "Clear entire inbox? All conversations will be removed from your view.",
    );
    if (!confirmed) return;

    setIsClearingInbox(true);
    try {
      const result = await clearInboxMutation({});
      alert(`Cleared ${result.deletedCount} conversations`);
    } catch (error: any) {
      alert(error.message || "Failed to clear inbox");
    } finally {
      setIsClearingInbox(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
        <p>You need to be signed in to access your inbox.</p>
      </div>
    );
  }

  // Get selected conversation details
  const selectedConversation = conversations?.find(
    (c) => c._id === selectedConversationId,
  );

  return (
    <div
      className="container mx-auto "
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Conversations List */}
        <div
          className={`${
            selectedConversationId ? "hidden lg:flex" : "flex"
          } w-full lg:w-80 flex-shrink-0 bg-white rounded-lg border border-[#D8E1EC] flex-col overflow-hidden`}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#D8E1EC] flex-shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-[#292929]" />
                <h1 className="text-lg font-semibold text-[#292929]">Chats</h1>
              </div>
              {conversations && conversations.length > 0 && (
                <button
                  onClick={handleClearInbox}
                  disabled={isClearingInbox}
                  className="text-xs text-red-600 hover:text-red-800 transition-colors font-medium"
                >
                  {isClearingInbox ? "Clearing..." : "Clear All"}
                </button>
              )}
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
            {!conversations || conversations.length === 0 ? (
              <div className="p-8 text-center text-[#787672]">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-[#D8E1EC]" />
                <p className="font-medium">No conversations yet</p>
                <p className="text-sm mt-2">
                  Start a conversation by visiting a user's profile
                </p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation._id}
                  onClick={() =>
                    navigate(`/inbox?conversation=${conversation._id}`)
                  }
                  className={`w-full p-3 border-b border-[#D8E1EC] hover:bg-[#F2F4F7] text-left transition-colors ${
                    selectedConversationId === conversation._id
                      ? "bg-[#F2F4F7]"
                      : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-[#292929] text-sm truncate">
                          {conversation.otherUser.name}
                        </p>
                        {!conversation.otherUser.inboxEnabled && (
                          <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            Disabled
                          </span>
                        )}
                      </div>
                      {conversation.lastMessage && (
                        <p className="text-xs text-[#787672] truncate">
                          {conversation.lastMessage.content}
                        </p>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="flex-shrink-0">
                        <div className="bg-[#292929] text-white text-xs font-medium rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                          {conversation.unreadCount}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div
          className={`${
            selectedConversationId ? "flex" : "hidden lg:flex"
          } flex-1 flex-col overflow-hidden bg-white rounded-lg border border-[#D8E1EC]`}
        >
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-[#787672]">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-[#D8E1EC]" />
                <p className="font-medium">
                  Select a conversation to view messages
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-[#D8E1EC] flex items-center justify-between flex-shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("/inbox")}
                    className="lg:hidden p-2 hover:bg-[#F2F4F7] rounded-md transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-[#292929]" />
                  </button>
                  <div>
                    <p className="font-semibold text-[#292929]">
                      {selectedConversation?.otherUser.name}
                    </p>
                    {selectedConversation?.otherUser.username && (
                      <p className="text-xs text-[#787672]">
                        @{selectedConversation.otherUser.username}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDeleteConversation}
                  disabled={isDeleting}
                  className="p-2 hover:bg-[#F2F4F7] rounded-md transition-colors text-red-600"
                  title="Delete conversation"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-[#ffffff]">
                {messages && messages.length === 0 ? (
                  <div className="text-center text-[#787672] py-8">
                    <p className="font-medium">
                      No messages yet. Start the conversation!
                    </p>
                  </div>
                ) : (
                  messages?.map((message) => {
                    const isOwnMessage =
                      message.sender._id === authUser.publicMetadata.userId;
                    return (
                      <div
                        key={message._id}
                        className={`flex flex-col ${
                          isOwnMessage ? "items-end" : "items-start"
                        }`}
                      >
                        {/* Sender name with link */}
                        {message.sender.username && (
                          <a
                            href={`/${message.sender.username}`}
                            className="text-xs text-gray-600 hover:text-gray-900 mb-1 px-1"
                          >
                            {message.sender.name}
                          </a>
                        )}
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            isOwnMessage
                              ? "bg-[#292929] text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <p className="text-sm break-words">
                            {message.content}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isOwnMessage ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            {new Date(message._creationTime).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedConversation?.otherUser.inboxEnabled === false ? (
                <div className="p-4 border-t border-[#D8E1EC] bg-[#F2F4F7] flex-shrink-0">
                  <div className="flex items-center gap-2 text-sm text-[#787672]">
                    <Inbox className="w-5 h-5" />
                    <p>
                      This user has disabled their inbox and cannot receive
                      messages.
                    </p>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-[#D8E1EC] flex-shrink-0 bg-white"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 border border-[#D8E1EC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#292929] focus:border-transparent text-sm"
                      maxLength={2000}
                      disabled={isSending}
                    />
                    <button
                      type="submit"
                      disabled={isSending || !messageInput.trim()}
                      className="px-5 py-2.5 bg-[#292929] text-white rounded-lg hover:bg-[#3d3d3d] transition-colors disabled:bg-[#D8E1EC] disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
                    >
                      {isSending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send
                    </button>
                  </div>
                  <p className="text-xs text-[#787672] mt-2">
                    {messageInput.length}/2000 characters
                  </p>
                </form>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar - Community Section */}
      </div>
    </div>
  );
}
