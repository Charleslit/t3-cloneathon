"use client";

import React, { useEffect, useState, FormEvent, KeyboardEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircleIcon, MessageSquareIcon, Loader2, AlertTriangleIcon, SearchIcon, XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // Import Framer Motion

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

// For search results
interface SearchResultMessage {
  id: string;
  content: string;
  createdAt: string;
  sessionId: string;
  session: { // Assuming session object is nested as defined in search API
    id: string;
    title: string;
  };
}

interface ChatSidebarProps {
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  currentSessionId: string | null;
  onSearchResultSelect: (messageId: string, sessionId: string) => void;
}

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-yellow-300 dark:bg-yellow-500 text-black rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

// Skeleton Loader for Sidebar Items
const SkeletonSidebarItem = () => (
  <div className="flex flex-col items-start p-2.5 space-y-1.5 w-full">
    <div className="h-4 bg-muted/60 rounded w-3/4 animate-pulse"></div>
    <div className="h-3 bg-muted/50 rounded w-1/2 animate-pulse"></div>
  </div>
);

export default function ChatSidebar({ onSessionSelect, onNewChat, currentSessionId, onSearchResultSelect }: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false); // To know if a search has been performed

  // Fetch initial sessions
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      setSessionsError(null);
      try {
        const response = await fetch('/api/chat/sessions');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch sessions: ${response.status}`);
        }
        const apiResponse = await response.json();
        setSessions(apiResponse.data || []);
      } catch (err) {
        setSessionsError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchSessions();
  }, []);

  const handleSearchSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const response = await fetch(`/api/chat/search?query=${encodeURIComponent(searchQuery)}&pageSize=20`); // Limiting to 20 results for now
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to search: ${response.status}`);
      }
      const data = await response.json();
      setSearchResults(data.messages || []);
      if ((data.messages || []).length === 0) {
        // setSearchError("No results found."); // Or handle as empty results
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setHasSearched(false);
  };

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date >= today) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); // Today: 3:45 PM
    } else if (date >= yesterday) {
      return 'Yesterday'; // Yesterday
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); // Older: Jun 10
    }
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  const renderContent = () => {
    if (hasSearched) {
      // Display search results
      if (isSearching) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </motion.div>
        );
      }
      if (searchError) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 m-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            <div className="flex items-center"> <AlertTriangleIcon className="mr-2 h-4 w-4 flex-shrink-0" /> <p className="font-semibold">Search Error:</p> </div>
            <p className="mt-1 pl-6">{searchError}</p>
          </motion.div>
        );
      }
      if (searchResults.length === 0) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 px-3">
            <SearchIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium text-foreground">No results for "{truncateText(searchQuery, 30)}"</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different search term.</p>
          </motion.div>
        );
      }
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          <AnimatePresence>
            {searchResults.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                exit={{ opacity: 0, x: -20 }} // Slide out on clear/new search
                layout // Animate layout changes
              >
                <Button
                  variant="ghost"
                  className="w-full h-auto py-2.5 px-3 text-left flex flex-col items-start group"
                  onClick={() => onSearchResultSelect(msg.id, msg.session.id)}
                >
                  <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 w-full flex justify-between items-center mb-0.5">
                    <span className="truncate max-w-[70%]">In: {truncateText(msg.session.title, 20)}</span>
                    <span>{formatDisplayDate(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-foreground group-hover:text-foreground leading-snug line-clamp-2">
                    <HighlightMatch text={truncateText(msg.content, 120)} query={searchQuery} />
                  </p>
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      );
    } else {
      // Display session list
      if (isLoadingSessions) {
        return (
          <div className="space-y-1 pt-2">
            {[...Array(5)].map((_, i) => <SkeletonSidebarItem key={i} />)}
          </div>
        );
      }
      if (sessionsError) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 m-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            <div className="flex items-center"> <AlertTriangleIcon className="mr-2 h-4 w-4 flex-shrink-0" /> <p className="font-semibold">Error:</p> </div>
            <p className="mt-1 pl-6">{sessionsError === "Failed to fetch sessions: 401" ? "Unauthorized. Please log in again." : "Could not load chats."}</p>
          </motion.div>
        );
      }
      if (sessions.length === 0) {
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 px-3">
            <MessageSquareIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No chat sessions yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/80">Start a new chat to see it here.</p>
          </motion.div>
        );
      }
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          <AnimatePresence>
            {sessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0, transition: { delay: index * 0.03 } }}
                exit={{ opacity: 0, x: -20 }}
                layout
              >
                <Button
                  variant={currentSessionId === session.id ? "secondary" : "ghost"}
                  className="w-full justify-start items-center text-sm h-auto py-2.5 px-3 group"
                  onClick={() => onSessionSelect(session.id)}
                  title={session.title}
                >
                  <div className="flex flex-col items-start text-left flex-grow overflow-hidden">
                    <span className="font-medium text-foreground group-hover:text-foreground truncate w-full">
                      {truncateText(session.title, 25)}
                    </span>
                    <span className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 mt-0.5">
                      {formatDisplayDate(session.updatedAt)}
                    </span>
                  </div>
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      );
    }
  };


  return (
    <div className="h-full w-full sm:w-64 md:w-72 flex flex-col bg-background border-r border-border/60">
      <div className="p-3 border-b border-border/60 space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start text-sm hover:bg-muted/50"
          onClick={() => { clearSearch(); onNewChat(); }} // Clear search when starting new chat
        >
          <PlusCircleIcon className="mr-2 h-4 w-4" />
          New Chat
        </Button>
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <Input
              type="search"
              placeholder="Search messages..."
              className="w-full text-sm h-9 pl-8 pr-8" // Added pr-8 for clear button
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') handleSearchSubmit();
                if (e.key === 'Escape') clearSearch();
              }}
            />
            <SearchIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={clearSearch}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>

      <ScrollArea className="flex-grow">
        <div className="p-3">
         {renderContent()}
        </div>
      </ScrollArea>
    </div>
  );
}
