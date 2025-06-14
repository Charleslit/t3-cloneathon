"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, FormEvent, useRef, Fragment, UIEvent } from "react"; // Removed useMemo, not used
import { useChat, Message as VercelChatMessage } from "ai/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardTitle } from "@/components/ui/card"; // Removed CardHeader
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { okaidia, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { SendHorizonalIcon, LogOutIcon, UserIcon, BotIcon, AlertTriangleIcon, Loader2, MenuIcon } from 'lucide-react'; // Added MenuIcon
import ChatSidebar from '@/components/layout/chat-sidebar'; // Import ChatSidebar
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet"; // For mobile sidebar

// Define a type for messages fetched from our DB, which includes a Prisma Role
interface ChatMessageFromDB {
  id: string;
  content: string;
  role: 'USER' | 'ASSISTANT';
  createdAt: Date;
  userId: string;
  sessionId: string; // Added sessionId
}

// Enhanced ChatMessageContent component with animations
const ChatMessageContent = ({ content }: { content: string }) => {
  const { resolvedTheme } = useTheme();
  const syntaxTheme = resolvedTheme === 'dark' ? okaidia : materialLight;

  const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const [fullMatch, language, code] = match;
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
    }
    parts.push(
      <div key={`code-${match.index}`} className="my-2 rounded-lg overflow-hidden bg-gray-900 dark:bg-gray-800">
        <SyntaxHighlighter
          language={language || 'plaintext'}
          style={syntaxTheme}
          customStyle={{
            borderRadius: '0px', // Handled by parent div
            margin: '0',
            padding: '1rem',
            fontSize: '0.875rem', // text-sm
            boxShadow: 'none', // Remove default shadow if any
          }}
          codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }} // Use monospace font from globals
          showLineNumbers
          wrapLines
        >
          {String(code).trim()}
        </SyntaxHighlighter>
      </div>
    );
    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    parts.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex)}</span>);
  }

  if (parts.length === 0) {
     return <div className="prose prose-sm dark:prose-invert max-w-none break-words">{content}</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="prose prose-sm dark:prose-invert max-w-none break-words"
    >
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </motion.div>
  );
};

// Helper function for date grouping
const getRelativeDateGroup = (messageDate: Date | undefined): string => {
  if (!messageDate) return ""; // Should not happen if messages have createdAt

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const msgDate = new Date(messageDate); // Ensure it's a Date object

  if (
    msgDate.getFullYear() === today.getFullYear() &&
    msgDate.getMonth() === today.getMonth() &&
    msgDate.getDate() === today.getDate()
  ) {
    return "Today";
  } else if (
    msgDate.getFullYear() === yesterday.getFullYear() &&
    msgDate.getMonth() === yesterday.getMonth() &&
    msgDate.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  } else {
    // Format: Month Day (e.g., "June 12")
    return msgDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }
};


export default function ChatPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [dbError, setDbError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null); // Ref for the ScrollArea's viewport
  const scrollAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null); // For scroll restoration
  const { resolvedTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // For mobile sheet control

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // Tracks if initial history for a session has been loaded

  // State for session management
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);


  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleChatSubmit,
    setMessages,
    isLoading, // This is the Vercel AI SDK's loading state, primarily for AI response generation
    error: chatError,
  } = useChat({
    api: "/api/chat/completions", // This remains for AI completion
    // We'll handle message saving, including sessionId, in handleSubmitWithSave and a modified onFinish
    onFinish: async (message: VercelChatMessage) => {
      // message here is the AI's response
      if (!currentSessionId) {
        console.error("No currentSessionId available to save AI message.");
        setDbError("Critical: Cannot save AI message, session ID missing.");
        return;
      }
      try {
        setDbError(null);
        const response = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: message.content,
            role: "ASSISTANT",
            sessionId: currentSessionId
          }),
        });
        if (!response.ok) {
          const errData = await response.json();
          setDbError(`Failed to save AI message: ${errData.message}`);
        }
        // Optionally, update the message in `messages` state with the ID from DB if needed
      } catch (err) {
        setDbError(`Error saving AI message: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    onError: (error) => console.error("Chat completion error:", error)
  });


  // Effect to fetch history when session is loaded and currentSessionId is set
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }

    // This function will be called to fetch chat history for the currentSessionId
    const fetchHistory = async (sessionId: string, pageNum: number) => {
      if (!sessionId) {
        setMessages([]);
        setInitialLoadComplete(true); // Nothing to load
        setCurrentPage(1);
        setTotalPages(1);
        return;
      }
      if (pageNum > 1 && isLoadingMore) return;
      // Allow refetch of page 1 if initialLoadComplete is false for the current session
      if (pageNum > 1 && currentPage >= totalPages && totalPages !== 1 && initialLoadComplete) return;


      if (pageNum > 1) {
        setIsLoadingMore(true);
        const viewport = chatScrollAreaRef.current;
        if (viewport) {
          scrollAnchorRef.current = {
            scrollHeight: viewport.scrollHeight,
            scrollTop: viewport.scrollTop,
          };
        }
      }
      // When fetching page 1, initialLoadComplete is already false or set by onSessionSelect/onNewChat

      try {
        setDbError(null);
        const response = await fetch(`/api/chat/messages?sessionId=${sessionId}&page=${pageNum}&pageSize=20`);
        if (!response.ok) {
          const errData = await response.json();
          setDbError(`Failed to load chat history (session: ${sessionId}, page ${pageNum}): ${errData.message}`);
          if (response.status === 403 || response.status === 404) { // Unauthorized or not found
             console.error("Session invalid or user not authorized for session:", sessionId);
             // Potentially clear currentSessionId or redirect
          }
          if (pageNum > 1) setIsLoadingMore(false);
          else setInitialLoadComplete(true); // Allow UI to render even if page 1 fails
          return;
        }
        const data = await response.json();
        const historyFromDb: ChatMessageFromDB[] = data.messages;

        setTotalPages(data.totalPages);
        setCurrentPage(data.currentPage);

        const vercelAiMessages: VercelChatMessage[] = historyFromDb.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role.toLowerCase() as 'user' | 'assistant',
          createdAt: new Date(msg.createdAt),
        }));

        setMessages(prevMessages => {
          if (pageNum === 1) {
            return vercelAiMessages;
          } else {
            const existingMessageIds = new Set(prevMessages.map(msg => msg.id));
            const newMessages = vercelAiMessages.filter(msg => !existingMessageIds.has(msg.id));
            return [...newMessages, ...prevMessages];
          }
        });

      } catch (err) {
        setDbError(`Error loading history (session: ${sessionId}, page ${pageNum}): ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (pageNum > 1) {
          setIsLoadingMore(false);
        }
        // Set initialLoadComplete to true only after page 1 successfully loads (or fails gracefully)
        if (pageNum === 1) {
          setInitialLoadComplete(true);
        }
      }
    };

    // If currentSessionId IS set and initial history for THIS session hasn't been loaded
    if (session && currentSessionId && !initialLoadComplete) {
      // setMessages([]); // Clearing messages is now handled by onSessionSelect or when new session ID is set in handleSubmitWithSave
      // setCurrentPage(1);
      // setTotalPages(1);
      fetchHistory(currentSessionId, 1);
    } else if (!currentSessionId && initialLoadComplete) {
      // This case means user explicitly started a new chat, or no session is active.
      // initialLoadComplete should be true here because there's no history to load for a non-existent/new session.
      // If it was false, it might try to fetch with null sessionID.
      // setMessages([]); // Already handled by onNewChat
      // setCurrentPage(1);
      // setTotalPages(1);
    }
  }, [session, sessionStatus, router, currentSessionId, initialLoadComplete, setMessages]);


  useEffect(() => {
    const viewport = chatScrollAreaRef.current;
    if (viewport && scrollAnchorRef.current && isLoadingMore) {
      // This effect will run after messages are updated and isLoadingMore is true
      // We want to restore scroll position *after* DOM has updated with new messages
      // This is a bit of a race, ideally useLayoutEffect or a callback from setMessages
      // For now, a small timeout might help ensure DOM is updated.

      // This part will be tricky. Let's try to restore in the `finally` block of fetchHistory first,
      // or another useEffect that specifically watches messages count + isLoadingMore.
    }

    // Scroll to bottom for new messages OR to a specific message
    if (initialLoadComplete && messages.length > 0) {
      if (scrollToMessageId) {
        const targetMessageElement = document.getElementById(`message-${scrollToMessageId}`);
        if (targetMessageElement) {
          targetMessageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Temporarily highlight and then remove highlight
          // The actual highlighting class will be applied based on scrollToMessageId state directly in JSX
          // Here, we just manage clearing the state.
          const timer = setTimeout(() => {
            setScrollToMessageId(null); // Clear after a delay to allow user to see highlight
          }, 3000); // Keep highlight for 3 seconds
          return () => clearTimeout(timer);
        } else {
          // Message not found yet, maybe not rendered. Clear scrollToMessageId to prevent repeated attempts if it's invalid.
          // Or, if confident it will render, don't clear, and let next message render trigger this.
          // For now, let's be cautious and clear if not found after initialLoadComplete.
           setScrollToMessageId(null);
        }
      } else if (!isLoadingMore) { // Only scroll to bottom if not loading more and no specific message to scroll to
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && (lastMessage.role === 'user' || lastMessage.role === 'assistant')) {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }
      }
    }
  }, [messages, initialLoadComplete, isLoadingMore, scrollToMessageId]);


  // Effect for scroll restoration
  useEffect(() => {
    if (!isLoadingMore && scrollAnchorRef.current && chatScrollAreaRef.current) {
      const viewport = chatScrollAreaRef.current;
      const { scrollHeight: oldScrollHeight, scrollTop: oldScrollTop } = scrollAnchorRef.current;
      const newScrollHeight = viewport.scrollHeight;
      // Only adjust scroll if it was a "load more" operation that added content at the top
      if (newScrollHeight > oldScrollHeight) {
         viewport.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;
      }
      scrollAnchorRef.current = null; // Reset anchor
    }
    // Watching messages.length to ensure it runs after DOM update from new messages
  }, [messages.length, isLoadingMore]);


  const handleSubmitWithSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessageContent = input;
    // Add message to UI optimistically, but it won't have the final ID or session ID yet.
    // This temporary message will be updated or replaced once the backend confirms.
    // For simplicity, we might avoid adding it here and let it be added when `messages` state is updated from fetchHistory or after save.
    // However, for responsiveness, an optimistic update is good.

    // The Vercel useChat hook's handleSubmit will append its own optimistic user message.
    // We need to ensure our saved message (with session ID) eventually aligns.

    try {
      setDbError(null);
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userMessageContent,
          role: "USER",
          sessionId: currentSessionId // Send currentSessionId (can be null for new chat)
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setDbError(`Failed to save your message: ${errData.message}`);
        // If saving fails, the optimistic message from useChat might need removal or an error state.
        return;
      }

      const savedUserMessage: ChatMessageFromDB = await response.json();

      // CRITICAL: Update currentSessionId if it was new or changed by the backend
      if (savedUserMessage.sessionId && savedUserMessage.sessionId !== currentSessionId) {
        setCurrentSessionId(savedUserMessage.sessionId);
        // If it's a new session, messages array should be cleared before Vercel AI SDK adds to it.
        // And initialLoadComplete should be reset so history for new session is fetched.
        setMessages([]); // Clear existing messages as this is a new session context
        setInitialLoadComplete(false); // This will trigger fetchHistory for the new session
      }

      // Now call the Vercel AI SDK's handleSubmit.
      // It will create its own optimistic user message.
      // And then the AI response will follow, which will be saved by onFinish.
      handleChatSubmit(e);

    } catch (err) {
      setDbError(`Error saving your message: ${err instanceof Error ? err.message : String(err)}`);
      // Handle UI update for optimistic message if it failed.
    }
    // Note: `input` is cleared by `handleChatSubmit`
  };

  if (sessionStatus === "loading") return <div className="flex items-center justify-center h-screen bg-background text-foreground"><p>Loading session...</p></div>;
  if (!session) return null;

  const handleSessionSelect = (sessionId: string) => {
    if (sessionId === currentSessionId) return; // Avoid reloading the same session

    setMessages([]); // Clear current messages immediately
    setCurrentSessionId(sessionId);
    setCurrentPage(1); // Reset pagination
    setTotalPages(1);
    setIsLoadingMore(false); // Reset loading more state
    setInitialLoadComplete(false); // This will trigger fetchHistory in useEffect for the new session
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handleNewChat = () => {
    setMessages([]); // Clear messages
    setCurrentSessionId(null); // Set to null to indicate a new chat context
    setCurrentPage(1);
    setTotalPages(1);
    setInitialLoadComplete(true); // No history to load for a new chat, so consider it complete
    setIsLoadingMore(false);
    setDbError(null); // Clear any previous DB errors
    // input field should be cleared by useChat hook or manually if needed
    // setInput(""); // If useChat doesn't clear it on new message sequence
    setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const sidebarContent = (
    <ChatSidebar
      currentSessionId={currentSessionId}
      onSessionSelect={handleSessionSelect}
      onNewChat={handleNewChat}
      // Consider passing a key prop like `key={currentSessionId}` if sidebar needs full re-render on session change
      // or a separate function to refresh its internal list if a new chat is auto-named after first message.
      onSearchResultSelect={(messageId, sessionId) => {
        if (currentSessionId !== sessionId) {
          // If the message is in a different session, switch to that session first.
          // handleSessionSelect will set initialLoadComplete to false,
          // which will trigger fetchHistory for the new session.
          handleSessionSelect(sessionId);
        }
        // Set the message ID to scroll to.
        // The useEffect hook watching [messages, initialLoadComplete, isLoadingMore, scrollToMessageId]
        // will handle the actual scrolling once messages for the session are loaded and initialLoadComplete is true.
        setScrollToMessageId(messageId);
        setIsSidebarOpen(false); // Close mobile sidebar if open
      }}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-b from-background to-background/95">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 md:w-72">
         {sidebarContent}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Enhanced Header with Glassmorphism */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-background/60 backdrop-blur-xl border-b border-border/40 p-3 sm:p-4 flex justify-between items-center sticky top-0 z-30" // z-30 for header
        >
          <div className="flex items-center space-x-2">
            {/* Mobile Sidebar Toggle */}
            <div className="md:hidden">
              <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MenuIcon className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 sm:w-80 bg-background">
                  {/* <SheetHeader className="p-4 border-b">
                    <SheetTitle>Chat Sessions</SheetTitle>
                  </SheetHeader> */}
                  {/* SheetClose can be integrated into onNewChat and onSessionSelect logic if sidebar items are direct children */}
                  {sidebarContent}
                </SheetContent>
              </Sheet>
            </div>
            <motion.h1
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              AI Chat
            </motion.h1>
          </div>
          <div className="flex items-center space-x-3">
            <p className="text-xs sm:text-sm text-muted-foreground hidden md:block">
              Welcome, {session.user?.name || session.user?.email}!
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hover:bg-foreground/10 transition-colors"
                title="Logout"
              >
                <LogOutIcon className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              </Button>
            </motion.div>
          </div>
        </motion.header>

        {/* Enhanced Chat Messages Area with Smooth Scrolling */}
        <ScrollArea
          className="flex-grow relative" // z-index might be needed if issues with sticky header/footer
          id="chat-scroll-area"
          viewportRef={chatScrollAreaRef} // Used @ts-ignore before, ensure it's fine
          onScroll={(event: UIEvent<HTMLDivElement>) => {
            const target = event.currentTarget;
            const scrollTopThreshold = 50;
            if (
              target.scrollTop < scrollTopThreshold &&
              !isLoadingMore &&
              initialLoadComplete &&
              currentSessionId &&
              currentPage < totalPages
            ) {
              if (currentSessionId) {
                const loadMore = async () => {
                  if (!currentSessionId || isLoadingMore || currentPage >= totalPages) return;
                  
                  setIsLoadingMore(true);
                  const viewport = chatScrollAreaRef.current;
                  if (viewport) {
                    scrollAnchorRef.current = {
                      scrollHeight: viewport.scrollHeight,
                      scrollTop: viewport.scrollTop,
                    };
                  }
                  try {
                    const response = await fetch(`/api/chat/messages?sessionId=${currentSessionId}&page=${currentPage + 1}&pageSize=20`);
                    if (!response.ok) {
                      const errData = await response.json();
                      setDbError(`Failed to load more messages: ${errData.message || response.statusText}`);
                      return;
                    }
                    const data = await response.json();
                    const newHistory: ChatMessageFromDB[] = data.messages;
                    setTotalPages(data.totalPages);
                    setCurrentPage(data.currentPage);
                    const vercelNewMessages: VercelChatMessage[] = newHistory.map(msg => ({ id: msg.id, content: msg.content, role: msg.role.toLowerCase() as 'user' | 'assistant', createdAt: new Date(msg.createdAt)}));
                    setMessages(prev => [...vercelNewMessages, ...prev]);
                  } catch (error) {
                    setDbError(error instanceof Error ? error.message : "Failed to load more messages");
                  }
                  finally { setIsLoadingMore(false); }
                };
                loadMore();
              }
            }
          }}
        >
          <div className="absolute inset-0 pointer-events-none z-0"> {/* Ensure this doesn't overlay content if z-index used elsewhere */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/5 to-background/10" />
          </div>
          <div className="p-4 sm:p-6 space-y-6 relative z-10"> {/* Content above gradient */}
            {/* Loading indicator for older messages */}
            <AnimatePresence>
              {isLoadingMore && ( // This is for loading more (older) messages
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex justify-center py-4"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
            {/* Initial loading indicator for a session's first page */}
            <AnimatePresence>
              {!initialLoadComplete && !isLoadingMore && currentSessionId && (
                   <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-10 text-muted-foreground"
                  >
                      <Loader2 className="mr-2 h-5 w-5 animate-spin mb-2" />
                      <span>Loading chat history...</span>
                  </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
            {(() => {
              let lastDateGroup: string | null = null;
              return messages.map((m: VercelChatMessage, index: number) => {
                const currentDateGroup = getRelativeDateGroup(m.createdAt);
                const showDateSeparator = currentDateGroup !== lastDateGroup;
                if (showDateSeparator) {
                  lastDateGroup = currentDateGroup;
                }

                return (
                  <Fragment key={`fragment-${m.id}`}>
                    {showDateSeparator && (
                      <motion.div
                        layout // Animate layout changes
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="relative py-3"
                      >
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-border/60"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-background px-2 text-xs text-muted-foreground">
                            {currentDateGroup}
                          </span>
                        </div>
                      </motion.div>
                    )}
                    <motion.div
                      id={`message-${m.id}`} // Add ID for scrolling
                      key={m.id} // Ensure motion key is on the animated element
                      layout // Animate layout changes for smooth message appearance/disappearance
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} transition-all duration-500 ease-out ${scrollToMessageId === m.id ? 'bg-blue-500/10 dark:bg-blue-400/10 rounded-lg p-1 -m-1 ring-1 ring-blue-500/30' : ''}`}
                    >
                      <div className={`flex items-start space-x-2 max-w-[80%] sm:max-w-[70%] ${
                        m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        >
                          {m.role === 'assistant' ? (
                            <Avatar className="w-8 h-8 border-2 border-primary/20">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                <BotIcon size={18}/>
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <Avatar className="w-8 h-8 border-2 border-muted-foreground/20">
                              <AvatarFallback className="bg-muted-foreground/10 text-muted-foreground">
                                <UserIcon size={18}/>
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </motion.div>

                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 20 }}
                          className="flex-1"
                        >
                          <Card className={`
                            rounded-xl shadow-lg transition-shadow hover:shadow-xl
                            ${m.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-none'
                              : 'bg-card/50 backdrop-blur-sm text-card-foreground rounded-bl-none'
                            }
                          `}>
                            <CardContent className="p-3 text-sm leading-relaxed">
                              <ChatMessageContent content={m.content} />
                              {m.createdAt && (
                                <p className={`text-xs mt-2 ${
                                  m.role === 'user'
                                    ? 'text-primary-foreground/70 text-right'
                                    : 'text-muted-foreground/70 text-left'
                                }`}>
                                  {new Date(m.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      </div>
                    </motion.div>
                  </Fragment>
                );
              });
            })()}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Enhanced Error Display with Animation */}
      <AnimatePresence>
        {(chatError || dbError) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-3 sm:p-4 border-t border-border/40 bg-background/60 backdrop-blur-sm"
          >
            <Card className="bg-destructive/5 border-destructive/30 p-3 rounded-lg shadow-sm">
              <div className="flex items-center space-x-2">
                <AlertTriangleIcon className="h-5 w-5 text-destructive" />
                <CardTitle className="text-sm font-medium text-destructive">Error</CardTitle>
              </div>
              <CardContent className="text-xs p-0 pt-2 pl-7 text-destructive/90">
                {chatError && <p>AI Error: {chatError.message}</p>}
                {dbError && <p>Database Error: {dbError}</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Message Input Form with Animation */}
      <motion.footer 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-background/60 backdrop-blur-xl border-t border-border/40 p-3 sm:p-4 sticky bottom-0 z-50"
      >
        <form onSubmit={handleSubmitWithSave} className="flex items-center space-x-2 sm:space-x-3">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder={currentSessionId ? "Type your message..." : "Start a new chat by typing here..."}
            className="flex-grow h-10 sm:h-11 rounded-full bg-muted/30 focus:bg-muted/50 backdrop-blur-sm border-border/40 focus-visible:ring-ring/50 focus-visible:ring-1 text-sm sm:text-base px-4 transition-all duration-200"
            disabled={isLoading || (!initialLoadComplete && !!currentSessionId)} // Disable if Vercel SDK loading OR initial history for a session is loading
            autoFocus
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              type="submit"
              disabled={isLoading || (!initialLoadComplete && !!currentSessionId) || !input.trim()}
              className="rounded-full w-10 h-10 sm:w-11 sm:h-11 p-0 flex-shrink-0 bg-primary hover:bg-primary/90 transition-colors"
              title="Send message"
            >
              {isLoading ? ( // This `isLoading` is from Vercel useChat SDK (AI response generation)
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendHorizonalIcon className="h-5 w-5" />
              )}
            </Button>
          </motion.div>
        </form>
      </motion.footer>
      </div> {/* End Main Chat Area Flex Col */}
    </div>
  );
}
