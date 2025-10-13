import { useEffect, useRef, useState, ReactNode } from "react";
import { emit, listen } from "@tauri-apps/api/event";

import { useUserStore } from "@/store/userStore";
import { useChatStore } from "@/store/chatStore";
import {
  Generate,
  GenerateWithWebSearch,
  GenerateWithSupermemory,
  GenerateImage,
  BASE_URL,
} from "@/api/chat";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Minimize2, Image, Plus } from "lucide-react";
import MarkdownRenderer from "@/components/misc/MarkdownRenderer";

import { animations } from "@/constants/animations";
import { invoke } from "@tauri-apps/api/core";

import {
  extractInsertableContent,
  InsertionContext,
  generateContextAwarePrompt,
} from "@/utils/textExtraction";
import WebSearchAnimation from "./WebSearchAnimation";
import OverlayMaximized from "./OverlayMaximized";
import * as mediaUtils from "../utils/media";
import * as messagesUtils from "../utils/messages";
import { injectTextToWindow } from "../utils/inject";
import * as uiUtils from "../utils/ui";
import { openaiLogo } from "@/constants/logos";
import { OverlayButton } from "./OverlayComponents";
import {
  ArrowElbowDownLeftIcon,
  BrainIcon,
  CheckIcon,
  GlobeSimpleIcon,
  SlidersHorizontalIcon,
  TrashIcon,
  EyeSlashIcon,
  Pencil,
  TrashSimpleIcon,
} from "@phosphor-icons/react";
const MODELS = [
  { label: "OpenAi", value: "gpt-4o-mini" },
  { label: "OpenAi", value: "gpt-4o" },
];

interface ChatViewProps {
  onClose: () => void;
  initialMessage?: string;
  initialAttachedImage?: string;
  smoothResize: (width: number, height: number) => void;
  windowName: string;
  windowIcon: string;
  windowHwnd: number | null;
  windowScreenshot?: string;
  isActive?: boolean;
  isMaximized?: boolean;
  setIsMaximized?: (maximized: boolean) => void;
  isPinned?: boolean;
  currentPage?: string;
  setCurrentPage?: (page: string) => void;
  assist?: boolean;
  assistMessage?: string;
  setAssistMessage?: (message: string) => void;
}

import Option from "./Option";

export const ChatView = ({
  onClose,
  initialMessage,
  initialAttachedImage,
  smoothResize,
  windowName,
  windowIcon,
  windowHwnd,
  windowScreenshot,
  isActive,
  isMaximized = false,
  setIsMaximized,
  isPinned = false,
  currentPage = "chat",
  setCurrentPage,
  assist = false,
  assistMessage = "",
  setAssistMessage,
}: ChatViewProps) => {
  const { email } = useUserStore();
  const {
    messages,
    setMessages,
    overlayChatTitle,
    setOverlayChatTitle,
    overlayConvoId,
    setOverlayConvoId,
  } = useChatStore();

  // Chat-specific state

  const [chatInputText, setChatInputText] = useState("");
  const [currentModel, setCurrentModel] = useState(MODELS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);
  const [currResponse, setCurrResponse] = useState<string>("");
  const [streamingMsg, setStreamingMsg] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>("");
  // Removed typing animation logic
  const [isInputTyping, setIsInputTyping] = useState(false);
  const [selectedTool, setSelectedTool] = useState<0 | 1 | 2 | 4>(0); // 0=none, 1=web search, 2=supermemory, 4= image generation
  const [resetToolAfterSend, setResetToolAfterSend] = useState<boolean>(
    localStorage.getItem("overlay_reset_tool_after_send") === "false"
      ? false
      : true,
  );
  // Multi-image support
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  // File attachments support
  const [attachedFiles, setAttachedFiles] = useState<
    {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[]
  >([]);

  // Helper to get the images to preview/send
  const getImagesToSend = () => mediaUtils.getImagesToSend(attachedImages, isActive, windowScreenshot);
  const [stealthMode, setStealthMode] = useState<boolean>(false);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(
    null,
  );
  const [imageReferenced, setImageReferenced] = useState<boolean>(false);
  // Refs for scrolling
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Load stealth mode state on component mount
  useEffect(() => {
    invoke<boolean>("get_stealth_mode_enabled")
      .then((v) => setStealthMode(!!v))
      .catch(() => {});

    // Listen for stealth mode changes from other components
    const unlisten = listen("stealth_mode_changed", (event: any) => {
      setStealthMode(event.payload.enabled);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for preference changes from settings
  useEffect(() => {
    const unlisten = listen(
      "overlay_reset_tool_after_send_changed",
      (event: any) => {
        setResetToolAfterSend(!!event.payload.enabled);
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleStreamAIResponse = async (
    email,
    message,
    newConvo,
    conversationId,

    provider,
    modelName,
    image,
    tool,
    newMessages,
  ) => {
    // Streaming block
    setStreamingMsg("");
    const response = await fetch(`${BASE_URL}/generate/msg`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        message,
        newConvo,
        conversationId,
        provider,
        modelName,
        image,
        tool,
        files: attachedFiles,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("ReadableStream not supported in this environment.");
    }
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      chunk.split("\n\n").forEach((event) => {
        if (!event.trim()) return;
        const dataLine = event.replace(/^data:\s*/, "");
        try {
          const data = JSON.parse(dataLine);
          if (data.type === "chunk") {
            fullText += data.content;
            setStreamingMsg((prev) => prev + data.content);
          } else if (data.type == "title") {
            if (overlayConvoId === -1) {
              setOverlayChatTitle(data.title);
              setOverlayConvoId(data.conversationId);
            }
            // Optionally handle title
          } else if (data.type === "search_site_found") {
            // Handle real-time search progress
            if ((window as any).addRealSearchSite) {
              try {
                (window as any).addRealSearchSite({
                  site: data.site,
                  domain: data.domain,
                  favicon: data.favicon,
                  title: data.title,
                  link: data.link,
                });
              } catch (error) {
                console.error("Error calling addRealSearchSite:", error);
              }
            }
          } else if (data.type === "done") {
            // Stream complete
            setStreamingMsg("");
            setCurrResponse(fullText);
            // Add final message to chat
            // Only append AI message, do not overwrite user message
            setMessages([
              ...newMessages,
              { sender: "ai", text: fullText, image: "" },
            ]);
            return {
              success: true,
              data: fullText,
            };
          }
        } catch {
          // fallback: raw chunk
          fullText += dataLine;
          setStreamingMsg((prev) => prev + dataLine);
        }
      });
    }

    setStreamingMsg("");
    setCurrResponse(fullText);
    // setMessages([...messages, { sender: "ai", text: fullText, image: "" }]);
    return {
      success: true,
      data: fullText,
    };
  };
  // Removed typingRef for typing animation

  const handleAIResponse = async (userMsg: string, manualImage?: string) => {
    if (userMsg.trim() === "") return;
    const imagesToSend = manualImage ? [manualImage] : getImagesToSend();

    let enhancedMessage = userMsg;
    // Create context for smart AI prompting
    const insertionContext: InsertionContext = {
      windowName,
      windowScreenshot: windowScreenshot || undefined,
    };
    // Enhance the user message with context for better AI responses
    const contextAwareMessage = generateContextAwarePrompt(
      enhancedMessage,
      insertionContext,
    );
    const newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg, // Show original message to user
        image: imagesToSend,
        files: attachedFiles, // Include attached files
      },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);
    // Set appropriate animation state based on selected tool
    if (selectedTool === 1) {
      // Web search animation
      setCurrentSearchQuery(userMsg);
      setIsWebSearching(true);
      setIsAIThinking(false);
    } else {
      // Regular AI thinking animation
      setIsAIThinking(true);
      setIsWebSearching(false);
    }
    try {
      let ai_res;
      if (imagesToSend.length === 0) {
        await handleStreamAIResponse(
          email,
          contextAwareMessage, // Use context-aware message
          overlayConvoId === -1,
          overlayConvoId,
          currentModel.label,
          currentModel.value,
          [],
          selectedTool,
          newMessages,
        );
      } else {
        ai_res = await Generate({
          email: email,
          message: contextAwareMessage, // Use context-aware message
          newConvo: overlayConvoId === -1,
          conversationId: overlayConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imagesToSend,
          files: attachedFiles,
        });
        const updatedMessages = [
          ...newMessages,
          { sender: "ai" as const, text: ai_res.aiResponse, image: [""] },
        ];
        setMessages(updatedMessages);
        setCurrResponse(ai_res.aiResponse);
        if (overlayConvoId === -1) {
          setOverlayChatTitle(ai_res.title);
          setOverlayConvoId(ai_res.conversationId);
        }
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: "Sorry, I encountered an error.",
          image: [""],
        },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      setIsAIThinking(false);
      setIsWebSearching(false);
      setStreamingMsg("");
    }
  };

  // Effect to handle the initial message passed from the overlay bar
  useEffect(() => {
    if (initialMessage) {
      if (initialAttachedImage) {
        setAttachedImages([initialAttachedImage]);
      }
      handleAIResponse(initialMessage, initialAttachedImage || undefined);
    }
  }, [initialMessage, initialAttachedImage]);

  // Scroll to bottom when new messages appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount

  // Removed typing animation effect

  const handleNewChat = () => {
    setMessages([]);
    setOverlayChatTitle("New Chat");
    setOverlayConvoId(-1);
    setChatInputText("");
    setCurrResponse("");
    setIsInputTyping(false);
    setSelectedTool(0);
    setAttachedImages([]);
    setAttachedFiles([]);
  };

  const handlePaste = (e: React.ClipboardEvent) => mediaUtils.handlePasteImage(e, setAttachedImages);

  // Clear attached image
  const clearImage = (idx: number) => mediaUtils.removeAttachedImage(setAttachedImages, idx);

  const handleFileSelect = async () => mediaUtils.openFileSelector(setAttachedFiles);

  const clearFile = (idx: number) => mediaUtils.removeAttachedFile(setAttachedFiles, idx);

  const getPlaceholderText = () => {
    if (attachedImages.length > 0) {
      return "Describe what you want to know about these images...";
    }
    if (attachedFiles.length > 0) {
      return "Ask questions about the uploaded files...";
    }

    switch (selectedTool) {
      case 1:
        return "Web search me...";
      case 2:
        return "Super memory search...";
      case 4:
        return "Generate or modify image...";
      default:
        return "Enter your message or paste a screenshot";
    }
  };

  const handleReferenceImage = (imageBase64: string) => {
    mediaUtils.addReferencedImage(setAttachedImages, imageBase64);
    setImageReferenced(true);
    const timeout = selectedTool === 4 ? 3000 : 2000;
    setTimeout(() => setImageReferenced(false), timeout);
  };

  // Handler for web search
  const handleWebSearch = async (userMsg: string, manualImage?: string) => {
    if (!userMsg.trim()) return;

    // Note: File content will be processed by the backend
    let enhancedMessage = userMsg;

    // Create context for web search
    const insertionContext: InsertionContext = {
      windowName,
      windowScreenshot: windowScreenshot || undefined,
    };
    const contextAwareMessage = generateContextAwarePrompt(
      enhancedMessage,
      insertionContext,
    );
    const imagesToSend = manualImage ? [manualImage] : getImagesToSend();
    const newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg, // Show original message to user
        image: imagesToSend,
        files: attachedFiles, // Include attached files
      },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);
    setCurrentSearchQuery(userMsg);
    setIsWebSearching(true);
    try {
      const ai_res = await GenerateWithWebSearch({
        email: email,
        message: contextAwareMessage, // Use context-aware message
        newConvo: overlayConvoId === -1,
        conversationId: overlayConvoId,
        provider: currentModel.label,
        modelName: currentModel.value,
        image: imagesToSend,
      });
      const updatedMessages = [
        ...newMessages,
        { sender: "ai" as const, text: ai_res.aiResponse, image: [""] },
      ];
      setMessages(updatedMessages);
      setCurrResponse(ai_res.aiResponse);
      if (overlayConvoId === -1) {
        setOverlayChatTitle(ai_res.title);
        setOverlayConvoId(ai_res.conversationId);
      }
    } catch (error) {
      console.error("Error getting web search response:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: "Sorry, I encountered an error with web search.",
          image: [""],
        },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      setIsWebSearching(false);
    }
  };

  // Handler for supermemory
  const handleSupermemory = async (userMsg: string, manualImage?: string) => {
    if (!userMsg.trim()) return;

    // Note: File content will be processed by the backend
    let enhancedMessage = userMsg;

    // Create context for supermemory
    const insertionContext: InsertionContext = {
      windowName,
      windowScreenshot: windowScreenshot || undefined,
    };
    const contextAwareMessage = generateContextAwarePrompt(
      enhancedMessage,
      insertionContext,
    );
    const imagesToSend = manualImage ? [manualImage] : getImagesToSend();
    const newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg, // Show original message to user
        image: imagesToSend,
        files: attachedFiles, // Include attached files
      },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);
    setIsAIThinking(true);
    try {
      const ai_res = await GenerateWithSupermemory({
        email: email,
        message: contextAwareMessage, // Use context-aware message
        newConvo: overlayConvoId === -1,
        conversationId: overlayConvoId,
        provider: currentModel.label,
        modelName: currentModel.value,
        image: imagesToSend,
      });
      const updatedMessages = [
        ...newMessages,
        { sender: "ai" as const, text: ai_res.aiResponse, image: [""] },
      ];
      setMessages(updatedMessages);
      setCurrResponse(ai_res.aiResponse);
      if (overlayConvoId === -1) {
        setOverlayChatTitle(ai_res.title);
        setOverlayConvoId(ai_res.conversationId);
      }
    } catch (error) {
      console.error("Error getting supermemory response:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: "Sorry, I encountered an error with memory search.",
          image: [""],
        },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      setIsAIThinking(false);
    }
  };

  const handleImageGeneration = async (
    userMsg: string,
    manualImage?: string,
  ) => {
    if (!userMsg.trim()) return;
    const imagesToSend = manualImage ? [manualImage] : getImagesToSend();

    // Note: File content will be processed by the backend
    let enhancedMessage = userMsg;

    const newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg,
        image: imagesToSend,
        files: attachedFiles, // Include attached files
      },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);
    setIsImageGenerating(true);
    try {
      const ai_res = await GenerateImage({
        email: email,
        message: userMsg,
        newConvo: overlayConvoId === -1,
        conversationId: overlayConvoId,
        provider: currentModel.label,
        modelName: currentModel.value,
        image: imagesToSend,
      });
      const updatedMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: ai_res.aiResponse,
          image: ai_res.imageAi,
        },
      ];
      setMessages(updatedMessages);
      setCurrResponse(ai_res.aiResponse);
      if (overlayConvoId === -1) {
        setOverlayChatTitle(ai_res.title);
        setOverlayConvoId(ai_res.conversationId);
      }
    } catch (error) {
      console.error("Error getting web search response:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: "Sorry, I encountered an error with web search.",
          image: [""],
        },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      setIsImageGenerating(false);
    }
  };
  const handleSendMessage = () => {
    const userMsg = chatInputText.trim();
    if (!userMsg) return;
    setChatInputText("");
    setIsInputTyping(false);
    if (selectedTool === 1) {
      // Use the streaming web search implementation
      handleAIResponse(userMsg);
    } else if (selectedTool === 2) {
      handleSupermemory(userMsg);
    } else if (selectedTool == 4) {
      handleImageGeneration(userMsg);
    } else {
      handleAIResponse(userMsg);
    }
    if (resetToolAfterSend) {
      setSelectedTool(0);
      // Request overlay shell to stop analyzing (disable screen watch)
      try {
        emit("overlay_request_stop_analyze", {});
      } catch (_) {}
    }
    setAttachedImages([]);
    setAttachedFiles([]);
  };

  const getCurrentTime = uiUtils.getCurrentTime;

  const handleInject = async () => {
    try {
      if (!windowHwnd) {
        console.error("No window HWND available");
        return;
      }

      // Create context for smart insertion
      const insertionContext: InsertionContext = {
        windowName,
        windowScreenshot: windowScreenshot || undefined,
        // Will be auto-detected from windowName
      };

      const insertableText = extractInsertableContent(
        currResponse,
        insertionContext,
      );

      if (!insertableText) {
        console.warn("No insertable text extracted, using original response");
        await invoke("inject_text_to_window_by_hwnd", {
          text: currResponse,
          hwnd: windowHwnd,
        });
      } else {
        await invoke("inject_text_to_window_by_hwnd", {
          text: insertableText,
          hwnd: windowHwnd,
        });
      }
    } catch (error) {
      console.error("Injection failed:", error);
    }
  };

  const [optionsOpen, setOptionsOpen] = useState(false);

  // Maximized page content moved to `OverlayMaximized` component

  return (
    <motion.div
      onClick={() => {
        setOptionsOpen(false);
      }}
      initial={{ opacity: 1, y: "-100%" }}
      animate={{ opacity: 1, y: "0%" }}
      exit={{ opacity: 0, y: "-100%" }}
      transition={{ duration: animations.overlayChat, ease: "circInOut" }}
      ref={chatContainerRef}
      className={`no-drag flex flex-col h-screen w-full overflow-hidden relative z-[1000] rounded-xl shadow-lg mt-2 ${
        isMaximized ? "min-h-[95vh]" : "min-h-[400px]"
      }`}
    >
      <div
        className={`flex-1 flex flex-col text-foreground dark:bg-[#010101] bg-white relative transition-all duration-200 ${
          isMaximized ? "w-screen" : "min-h-[300px]"
        }`}
        style={isMaximized ? { height: "calc(100vh - 30px)" } : {}}
      >
        {/* Render page content for maximized state or chat header */}
        {isMaximized && currentPage !== "chat" ? (
          <>
            {/* Centered overlay bar for maximized pages */}
            <div className="h-fit items-center border-b-2 overflow-hidden  border-b-border/20  mx-auto flex mb-6">
              <div className="h-full w-full flex justify-between items-center p-2 tracking-tight font-medium">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-foreground min-w-0 flex-1">
                    <span className="truncate flex-1 px-2 text-sm font-semibold capitalize">
                      {currentPage}
                    </span>
                  </div>
                </div>
                <div className="flex items-center h-full ml-auto p-1 gap-1">
                  <OverlayButton
                    onClick={() => setIsMaximized(false)}
                    title="Minimize"
                    draggable={!isPinned}
                  >
                    <Minimize2 size={16} />
                  </OverlayButton>
                </div>
              </div>
            </div>
            <OverlayMaximized currentPage={currentPage} isMaximized={isMaximized} />
          </>
        ) : (
          <>
            {/* Chat header */}
            <div
              className={`h-fit items-center border-b-2 overflow-hidden border-b-border/20 flex ${
                isMaximized ? "w-[600px] mx-auto" : "w-full"
              }`}
            >
              <div className="h-full w-full flex items-center p-2 tracking-tight font-medium">
                {/* Title section with fixed max width */}
                <div className="flex items-center gap-2 min-w-0 max-w-[60%]">
                  <div className="flex items-center gap-2 text-foreground min-w-0 flex-1">
                    {titleLoading ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Loader2 className="animate-spin" size={16} />
                        <span className="truncate">Generating title...</span>
                      </div>
                    ) : (
                      <span className="truncate px-2 text-sm">
                        {overlayChatTitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Insert button */}
                <div className="flex items-center gap-2 ml-2">
                  <AnimatePresence>
                    {currResponse && currResponse.trim() && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{
                          duration: 0.25,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                        onClick={handleInject}
                        className="shrink-0 bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 backdrop-blur-sm border border-white/40 dark:border-white/20 text-foreground px-2 py-1 rounded-md shadow-sm hover:shadow-md flex items-center gap-1 transition-all duration-200"
                        title={`Insert text into ${
                          windowName || "active window"
                        }`}
                      >
                        {windowIcon ? (
                          <img
                            src={windowIcon}
                            alt="App icon"
                            className="w-4 h-4 rounded-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-4 h-4 bg-gray-300 rounded-sm flex-shrink-0 flex items-center justify-center text-xs">
                            ?
                          </div>
                        )}
                        <span className="text-xs font-medium whitespace-nowrap">
                          Insert
                        </span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Time and controls section */}
                <div className="flex items-center gap-2 ml-auto">
                  <div className="text-zinc-600 text-sm font-medium shrink-0">
                    {getCurrentTime().toUpperCase()}
                  </div>
                  <OverlayButton onClick={handleNewChat} title="New Chat">
                    <TrashIcon weight="bold" />
                  </OverlayButton>
                </div>
              </div>
            </div>

            {/* Image referenced notification */}
            <AnimatePresence>
              {imageReferenced && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-2 right-2 z-50 bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2"
                >
                  <Image size={16} />
                  {selectedTool === 4
                    ? "Image ready for modification"
                    : "Image referenced for next message"}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide relative flex flex-col">
              {loadingMessages && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                  <Loader2 className="animate-spin text-zinc-700" size={24} />
                </div>
              )}
              {/* Assist message when assist mode is active */}
              {assist && assistMessage && (
                <div className="p-3 rounded-lg text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 self-start text-left w-fit max-w-[85%]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Assist Mode Active
                    </span>
                  </div>
                  <div className="text-blue-800 dark:text-blue-200">
                    {assistMessage}
                  </div>
                </div>
              )}
              {/* Render all messages except the streaming one */}
              {messages.map((msg, idx) => (
                <div key={idx} className="w-full flex mb-4">
                  <div
                    className={`flex w-full ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] ${
                        msg.sender === "user"
                          ? "bg-zinc-800 dark:bg-zinc-900 text-white rounded-2xl rounded-br-md px-4 py-3"
                          : "bg-transparent text-foreground"
                      }`}
                    >
                      {msg.sender === "ai" ? (
                        <div className="prose prose-base max-w-none text-foreground dark:text-zinc-100 leading-relaxed">
                          <div className="space-y-3">
                            {(() => {
                              try {
                                return <MarkdownRenderer source={msg.text || ""} />;
                              } catch (error) {
                                console.error("Markdown render error:", error);
                                return (
                                  <div className="whitespace-pre-wrap text-[15px] leading-7">
                                    {msg.text}
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[15px] leading-6 font-medium">
                          {msg.text}
                        </div>
                      )}

                      {/* Show image if exists */}
                      {msg.image &&
                        msg.image.filter((img: string) => img.trim() !== "")
                          .length > 0 && (
                          <div className="mt-2 flex flex-col gap-2">
                            {msg.image
                              .filter((img: string) => img.trim() !== "")
                              .map((img: string, imgIdx: number) => (
                                <div
                                  key={imgIdx}
                                  className="relative inline-block"
                                  onMouseEnter={() =>
                                    msg.sender === "ai"
                                      ? setHoveredImageIndex(idx)
                                      : null
                                  }
                                  onMouseLeave={() =>
                                    setHoveredImageIndex(null)
                                  }
                                >
                                  <img
                                    src={img}
                                    alt={
                                      msg.sender === "user"
                                        ? "User uploaded"
                                        : "AI generated"
                                    }
                                    className={`max-w-full rounded-lg border border-gray-300 transition-all duration-200 ${
                                      msg.sender === "ai"
                                        ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg"
                                        : ""
                                    }`}
                                  />

                                  {/* Hover overlay only for AI images */}
                                  {msg.sender === "ai" &&
                                    hoveredImageIndex === idx && (
                                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center transition-all duration-200 animate-in fade-in-0">
                                        <button
                                          onClick={() =>
                                            handleReferenceImage(img)
                                          }
                                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 text-sm font-medium shadow-lg transform ${
                                            selectedTool === 4
                                              ? "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-xl"
                                              : "bg-white text-black hover:bg-gray-100 hover:shadow-xl"
                                          }`}
                                          title={
                                            selectedTool === 4
                                              ? "Use this image for further modifications"
                                              : "Reference this image in your next message"
                                          }
                                        >
                                          <Image size={16} />
                                          {selectedTool === 4
                                            ? "Modify"
                                            : "Reference"}
                                        </button>
                                      </div>
                                    )}
                                </div>
                              ))}
                          </div>
                        )}

                      {/* Show attached files if exist */}
                      {msg.files && msg.files.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            Attached files:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {msg.files.map((file: any, fileIdx: number) => (
                              <div
                                key={fileIdx}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                              >
                                <div className="flex flex-col">
                                  <div className="text-sm font-medium truncate max-w-[150px]">
                                    {file.name}
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    {(file.size / 1024).toFixed(1)}KB •{" "}
                                    {file.type}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Streaming AI message (if any) */}
              {streamingMsg && (
                <div className="w-full flex mb-4">
                  <div className="flex w-full justify-start">
                    <div className="max-w-[85%] bg-transparent text-foreground">
                      <div className="prose prose-base max-w-none text-foreground dark:text-zinc-100 leading-relaxed">
                        <div className="space-y-3">
                          <MarkdownRenderer source={streamingMsg} />
                          {/* Streaming cursor */}
                          <span className="inline-block w-2 h-5 bg-zinc-600 dark:bg-zinc-400 animate-pulse ml-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Web Search Animation */}
              <WebSearchAnimation
                isSearching={isWebSearching}
                searchQuery={currentSearchQuery}
                isResponseStreaming={streamingMsg.length > 0}
              />

              {/* Image Generation Animation */}
              <AnimatePresence mode="popLayout">
                {isImageGenerating && streamingMsg.length === 0 && (
                  <motion.div
                    className="flex gap-2 mt-2 mx-2 dark:text-zinc-200  font-medium items-center text-sm h-fit"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div
                      initial={{ borderRadius: "0%", rotate: "90deg" }}
                      animate={{
                        borderRadius: ["0%", "50%", "0%"],
                        rotate: ["90deg", "180deg", "270deg"],
                      }}
                      transition={{
                        duration: 1,
                        ease: "linear",
                        repeat: Infinity,
                        repeatType: "loop",
                      }}
                      className="self-start flex items-center relative border-[3px] border-surface size-[20px] justify-center"
                    ></motion.div>

                    <div className="animate-pulse">Rae is drawing...</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Thinking Animation - Simple Pulsing Dot */}
              <AnimatePresence mode="popLayout">
                {isAIThinking &&
                  !isWebSearching &&
                  !isImageGenerating &&
                  streamingMsg.length === 0 && (
                    <motion.div
                      className="flex gap-2 mt-2 mx-2 dark:text-zinc-200  font-medium items-center text-sm h-fit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.div
                        initial={{ borderRadius: "0%", rotate: "90deg" }}
                        animate={{
                          borderRadius: ["0%", "50%", "0%"],
                          rotate: ["90deg", "180deg", "270deg"],
                        }}
                        transition={{
                          duration: 1,
                          ease: "linear",
                          repeat: Infinity,
                          repeatType: "loop",
                        }}
                        className="self-start flex items-center relative border-[3px] border-surface size-[20px] justify-center"
                      ></motion.div>

                      <div className="animate-pulse">Rae is thinking...</div>
                    </motion.div>
                  )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            {/* Input area with overlay icons */}
            <div className="relative">
              {/* Typing Icons - appear when user is typing */}

              <div className="h-[50px]  text-foreground bg-background relative flex items-center shrink-0">
                <div className="h-full w-fit relative  flex items-center p-1 pr-0 ">
                  <AnimatePresence>
                    {getImagesToSend().length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 1, x: "-20px" }}
                        animate={{ opacity: 1, scale: 1, x: "0%" }}
                        exit={{ opacity: 0, scale: 1, x: "-20px" }}
                        transition={{ duration: 0.3, ease: "circInOut" }}
                        className="absolute bottom-full p-1 left-0 flex gap-2"
                      >
                        {getImagesToSend().map((img, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              // Only allow removing user-attached images, not windowScreenshot if analysis is on
                              if (
                                isActive &&
                                windowScreenshot &&
                                img === windowScreenshot
                              )
                                return;
                              clearImage(idx);
                            }}
                            className="relative group h-[90px] w-[120px] border-2 border-border hover:border-surface/40 group transition-colors cursor-pointer overflow-hidden rounded-sm flex items-center justify-center"
                          >
                            <img
                              src={img}
                              alt={`Attached screenshot ${idx + 1}`}
                              className="size-full object-cover absolute left-0 top-0  z-10 cursor-pointer"
                              title={`Screenshot ${idx + 1} attached${isActive && windowScreenshot && img === windowScreenshot ? " (analysis)" : ""}${isActive && windowScreenshot && img === windowScreenshot ? " (cannot remove)" : " - Click to remove"}`}
                              onClick={() => {
                                if (
                                  isActive &&
                                  windowScreenshot &&
                                  img === windowScreenshot
                                )
                                  return;
                                clearImage(idx);
                              }}
                            />
                            <TrashSimpleIcon
                              weight="bold"
                              className={`z-40 text-white group-hover:opacity-100 opacity-0 transition-all${isActive && windowScreenshot && img === windowScreenshot ? " hidden" : ""}`}
                            />
                            <div className="absolute group-hover:opacity-100 opacity-0 transition-all z-30 blur-xl -bottom-1/2 left-1/2 -translate-x-1/2  rounded-full pointer-events-auto bg-surface/70 size-[90px] flex items-center justify-center"></div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Attached Files Display */}
                  <AnimatePresence>
                    {attachedFiles.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 1, x: "-20px" }}
                        animate={{ opacity: 1, scale: 1, x: "0%" }}
                        exit={{ opacity: 0, scale: 1, x: "-20px" }}
                        transition={{ duration: 0.3, ease: "circInOut" }}
                        className="absolute bottom-full p-1 left-0 flex gap-2"
                      >
                        {attachedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => clearFile(idx)}
                            className="relative group h-[60px] w-[120px] border-2 border-border hover:border-surface/40 group transition-colors cursor-pointer overflow-hidden rounded-sm flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"
                          >
                            <div className="flex flex-col items-center justify-center p-2 text-xs">
                              <div className="font-medium truncate w-full text-center">
                                {file.name}
                              </div>
                              <div className="text-zinc-500 text-[10px]">
                                {(file.size / 1024).toFixed(1)}KB
                              </div>
                            </div>
                            <TrashSimpleIcon
                              weight="bold"
                              className="z-40 text-white group-hover:opacity-100 opacity-0 transition-all absolute top-1 right-1"
                            />
                            <div className="absolute group-hover:opacity-100 opacity-0 transition-all z-30 blur-xl -bottom-1/2 left-1/2 -translate-x-1/2 rounded-full pointer-events-auto bg-surface/70 size-[60px] flex items-center justify-center"></div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <OverlayButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen((v) => !v);
                    }}
                    className="dark:bg-zinc-950"
                    title={currentModel.value}
                  >
                    <img
                      src={openaiLogo}
                      alt="OpenAI"
                      className="w-5 h-5 dark:invert"
                    />
                  </OverlayButton>
                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.12, ease: "easeInOut" }}
                        className="absolute z-40 left-1 bottom-full mb-1 overflow-hidden rounded-lg shadow-xl shadow-black/40 dark:bg-zinc-950 border border-border min-w-[160px]"
                      >
                        <div className="flex flex-col py-1">
                          {MODELS.map((model) => (
                            <button
                              key={model.value}
                              className={`h-9 text-left px-3 text-sm transition-colors whitespace-nowrap dark:text-zinc-300 hover:dark:text-white hover:dark:bg-zinc-900 ${
                                model.value === currentModel.value
                                  ? "font-semibold dark:bg-zinc-900"
                                  : ""
                              }`}
                              onClick={() => {
                                setCurrentModel(model);
                                setDropdownOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <img
                                  src={openaiLogo}
                                  alt="OpenAI"
                                  className="w-5 h-5 dark:invert"
                                />
                                <span>{model.value}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="h-full w-fit relative  flex items-center p-1 ">
                  <AnimatePresence>
                    {optionsOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0, scaleX: 0.9, scaleY: 0.95 }}
                          animate={{
                            opacity: 1,
                            scaleX: 1,
                            scaleY: 1,
                            // y: optionsOpen ? 0 : 10,
                          }}
                          exit={{
                            opacity: 0,
                            scaleX: 0.9,
                            scaleY: 0.95,
                          }}
                          style={{
                            transformOrigin: "bottom left",
                          }}
                          transition={{
                            duration: 0.2,
                            ease: "circInOut",
                          }}
                          className="dark:bg-zinc-950 z-40 overflow-hidden rounded-lg shadow-xl shadow-black/40 absolute w-[200px]  bottom-full flex flex-col "
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="h-fit p-1 flex flex-col gap-1"
                          >
                            <Option
                              active={selectedTool === 1}
                              onClick={() =>
                                setSelectedTool(selectedTool === 1 ? 0 : 1)
                              }
                              icon={<GlobeSimpleIcon className="text-lg" />}
                            >
                              {/* <GlobeSimpleIcon className="text-lg" /> */}
                              Web Search
                            </Option>
                            <Option
                              active={selectedTool === 2}
                              onClick={() =>
                                setSelectedTool(selectedTool === 2 ? 0 : 2)
                              }
                              icon={<BrainIcon className="text-lg" />}
                            >
                              {/* <BrainIcon className="text-lg" /> */}
                              Super Memory
                            </Option>
                            <Option
                              active={selectedTool === 4}
                              onClick={() =>
                                setSelectedTool(selectedTool === 4 ? 0 : 4)
                              }
                              icon={<Pencil className="text-lg" />}
                            >
                              Image Generation
                            </Option>
                            <Option
                              active={stealthMode}
                              onClick={async () => {
                                const newStealthMode = !stealthMode;
                                setStealthMode(newStealthMode);
                                try {
                                  await invoke("set_stealth_mode_enabled", {
                                    enabled: newStealthMode,
                                  });
                                  emit("stealth_mode_changed", {
                                    enabled: newStealthMode,
                                  });
                                } catch (error) {
                                  console.error(
                                    "Failed to toggle stealth mode:",
                                    error,
                                  );
                                  // Revert state if backend call fails
                                  setStealthMode(stealthMode);
                                }
                              }}
                              icon={<EyeSlashIcon className="text-lg" />}
                            >
                              Stealth Mode
                            </Option>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                  <OverlayButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setOptionsOpen((v) => !v);
                    }}
                    className="dark:bg-zinc-950"
                    title="Options"
                  >
                    <SlidersHorizontalIcon weight="bold" />
                  </OverlayButton>
                </div>
                <div className="w-full h-full py-1 relative">
                  <div className="relative  size-full dark:bg-zinc-950 focus-within:dark:bg-zinc-950 rounded-lg transition-all duration-100 border-2 dark:border-zinc-950 focus-within:dark:border-zinc-900">
                    {/* Tool indicator */}
                    <AnimatePresence>
                      {selectedTool > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className=" absolute left-2 top-1/2 transform -translate-y-1/2 z-10"
                        >
                          <div className="text-red-500">
                            {selectedTool === 1 && (
                              <GlobeSimpleIcon size={24} />
                            )}
                            {selectedTool === 2 && <BrainIcon size={24} />}
                            {selectedTool === 4 && <Pencil size={24} />}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <input
                      type="text"
                      value={chatInputText}
                      autoFocus
                      onChange={(e) => {
                        setChatInputText(e.target.value);
                        setIsInputTyping(e.target.value.length > 0);
                      }}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && chatInputText.trim())
                          handleSendMessage();
                      }}
                      placeholder={getPlaceholderText()}
                      className={`w-full dark:focus:placeholder:text-zinc-400/0 placeholder:transition-colors h-full bg-transparent text-foreground placeholder:text-foreground/50 text-sm outline-none pr-12 ${selectedTool > 0 ? "pl-12" : "px-4"}`}
                    />

                    {/* Image attachment indicator */}
                  </div>
                </div>
                <div className="h-full w-fit  flex items-center p-1 ">
                  <OverlayButton
                    onClick={handleFileSelect}
                    className="dark:bg-zinc-950"
                    title="Attach file"
                  >
                    <Plus size={16} />
                  </OverlayButton>
                </div>
                <div className="h-full w-fit  flex items-center p-1 ">
                  <OverlayButton
                    onClick={handleSendMessage}
                    className="dark:bg-zinc-950"
                    title="Send message"
                  >
                    <ArrowElbowDownLeftIcon weight="bold" />
                  </OverlayButton>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
