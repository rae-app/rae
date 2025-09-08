import { useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { useUserStore } from "@/store/userStore";
import { useChatStore } from "@/store/chatStore";
import { Generate, GenerateWithWebSearch, GenerateWithSupermemory } from "@/api/chat";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  SquareArrowOutUpRight,
  Trash2,
  ChevronDown,
  Loader2,
  Minimize2,
  Maximize2,
  ArrowRight,
  Globe,
  Brain,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import CodeBlock from "@/components/misc/CodeBlock";

import { animations } from "@/constants/animations";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/store/noteStore";
import animatedUnscreenGif from "../../../assets/animated-gifs01-unscreen.gif";
import { OverlayButton } from "./OverlayComponents";
import { ArrowElbowDownLeftIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon, CaretDoubleUpIcon, TrashIcon } from "@phosphor-icons/react";
const MODELS = [
  { label: "OpenAi", value: "gpt-4o-mini" },
  { label: "OpenAi", value: "gpt-4o" },
  { label: "gemini", value: "gemini-2.5-flash" },
];

interface ChatViewProps {
  setChatOpen: (open: boolean) => void;
  onClose: () => void;
  initialMessage?: string;
  showChat?: boolean;
  setShowChat?: (show: boolean) => void;
  smoothResize: (width: number, height: number) => void;
  windowName: string;
  windowIcon: string;
  expandedChat?: boolean;
  setExpandedChat?: (expanded: boolean) => void;
  windowScreenshot?: string;
}

// Utility function for smooth window resizing with easing
const performSmoothResize = async (
  targetWidth: number,
  targetHeight: number,
  duration: number = 160,
) => {
  const win = getCurrentWebviewWindow();
  const currentSize = await win.innerSize();

  const startWidth = currentSize.width;
  const startHeight = currentSize.height;
  const startTime = performance.now();

  return new Promise<void>((resolve) => {
    const animate = async (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth acceleration/deceleration
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOutCubic(progress);

      const currentWidth = Math.round(
        startWidth + (targetWidth - startWidth) * easedProgress,
      );
      const currentHeight = Math.round(
        startHeight + (targetHeight - startHeight) * easedProgress,
      );

      await win.setSize(new LogicalSize(currentWidth, currentHeight));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final size is exact
        await win.setSize(new LogicalSize(targetWidth, targetHeight));
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
};

export const ChatView = ({
  onClose,
  initialMessage,
  setChatOpen,
  showChat,
  setShowChat,
  smoothResize,
  windowName,
  windowIcon,
  expandedChat,
  setExpandedChat,
  windowScreenshot,
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

  const { notes } = useNoteStore();

  // Chat-specific state

  const [chatInputText, setChatInputText] = useState("");
  const [currentModel, setCurrentModel] = useState(MODELS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // const [expandedChat, setExpanded] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);
  const [currResponse, setCurrResponse] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [typingText, setTypingText] = useState<string>("");
  const [isTyping, setIsTyping] = useState(false);
  const [isInputTyping, setIsInputTyping] = useState(false);
  const [selectedTool, setSelectedTool] = useState<0 | 1 | 2>(0); // 0=none, 1=web search, 2=supermemory
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Refs for scrolling
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const typingRef = useRef<{ animationId: number | null }>({
    animationId: null,
  });

  const handleAIResponse = async (userMsg: string, manualImage?: string) => {
    if (userMsg.trim() === "") return;

    // Stop any ongoing typing animation
    setIsTyping(false);
    setTypingText("");
    if (typingRef.current.animationId !== null) {
      cancelAnimationFrame(typingRef.current.animationId);
      typingRef.current.animationId = null;
    }

    const newMessages = [
      ...messages,
      { sender: "user" as const, text: userMsg, image: attachedImage || windowScreenshot || "" },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);

    // Set AI thinking state to true
    setIsAIThinking(true);

    console.log("Sending:", messages, "overlay convo id :", overlayConvoId);

    // Use manual image if provided, otherwise use window screenshot
    const imageToSend = manualImage || windowScreenshot || "";
    console.log(
      "Image to send:",
      imageToSend.length || 0,
      "characters",
      manualImage ? "(manual)" : "(window screenshot)",
    );

    try {
      const ai_res = await Generate({
        email: email,
        message: userMsg,
        newConvo: overlayConvoId === -1,
        conversationId: overlayConvoId,
        provider: currentModel.label,
        modelName: currentModel.value,
        image: imageToSend,
      });

      // Start typing animation instead of immediately showing the full response
      const updatedMessages = [
        ...newMessages,
        { sender: "ai" as const, text: ai_res.aiResponse, image: "" },
      ];

      // Auto-expand chat when AI response is received (if not already expanded)
      if (!expandedChat && setExpandedChat) {
        await performSmoothResize(600, 570, 160);
        await performSmoothResize(600, 570, 160);
        setExpandedChat(true);
      }

      setMessages(updatedMessages);
      setCurrResponse(ai_res.aiResponse);
      // Start typing animation
      setIsTyping(true);
      setTypingText("");

      if (overlayConvoId === -1) {
        setOverlayChatTitle(ai_res.title);
        setOverlayConvoId(ai_res.conversationId);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessages = [
        ...newMessages,
        { sender: "ai" as const, text: "Sorry, I encountered an error.", image: "" },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      // Always clear the thinking state
      setIsAIThinking(false);
    }
  };

  // Effect to handle the initial message passed from the overlay bar
  useEffect(() => {
    if (initialMessage) {
      handleAIResponse(initialMessage);
    }
  }, [initialMessage]);

  // Scroll to bottom when new messages appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingRef.current.animationId !== null) {
        cancelAnimationFrame(typingRef.current.animationId);
      }
    };
  }, []);

  // Typing animation effect
  useEffect(() => {
    if (isTyping && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === "ai") {
        const fullText = lastMessage.text;
        let currentIndex = 0;
        let lastTime = 0;
        const typingSpeed = 20; // 20ms per character for smooth typing for ai response

        // Cancel any existing animation
        if (typingRef.current.animationId !== null) {
          cancelAnimationFrame(typingRef.current.animationId);
        }

        const typeNextChar = (currentTime: number) => {
          if (!isTyping) return; // Stop if typing was cancelled

          if (currentTime - lastTime >= typingSpeed) {
            if (currentIndex < fullText.length) {
              setTypingText(fullText.slice(0, currentIndex + 1));
              currentIndex++;
              lastTime = currentTime;
            } else {
              // Typing complete
              setIsTyping(false);
              setTypingText("");
              typingRef.current.animationId = null;
              return;
            }
          }

          typingRef.current.animationId = requestAnimationFrame(typeNextChar);
        };

        typingRef.current.animationId = requestAnimationFrame(typeNextChar);
      }
    }

    return () => {
      // Cleanup on unmount or dependency change
      if (typingRef.current.animationId !== null) {
        cancelAnimationFrame(typingRef.current.animationId);
        typingRef.current.animationId = null;
      }
    };
  }, [isTyping, messages]);

  const handleNewChat = () => {
    setMessages([]);
    setOverlayChatTitle("New Chat");
    setOverlayConvoId(-1);
    setChatInputText("");
    setCurrResponse(""); // Clear the current response to hide the insert button
    setIsTyping(false); // Stop typing animation
    setTypingText("");
    setIsInputTyping(false); // Reset input typing state
    setSelectedTool(0); // Reset selected tool
    setAttachedImage(null); // Clear attached image
    setImagePreview(null); // Clear image preview
    if (typingRef.current.animationId !== null) {
      cancelAnimationFrame(typingRef.current.animationId);
      typingRef.current.animationId = null;
    }
  };

  // Handle image paste
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setAttachedImage(base64);
            setImagePreview(base64);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // Clear attached image
  const clearImage = () => {
    setAttachedImage(null);
    setImagePreview(null);
  };

  // Handler for web search
  const handleWebSearch = async (userMsg: string, manualImage?: string) => {
    if (!userMsg.trim()) return;

    // Stop any ongoing typing animation
    setIsTyping(false);
    setTypingText("");
    if (typingRef.current.animationId !== null) {
      cancelAnimationFrame(typingRef.current.animationId);
      typingRef.current.animationId = null;
    }

    const newMessages = [
      ...messages,
      { sender: "user" as const, text: userMsg, image: attachedImage || windowScreenshot || "" }, // Normal message without prefix
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);

    setIsAIThinking(true);

    // Use manual image if provided, otherwise use window screenshot
    const imageToSend = manualImage || windowScreenshot || "";

    try {
      const ai_res = await GenerateWithWebSearch({
        email: email,
        message: userMsg,
        newConvo: overlayConvoId === -1,
        conversationId: overlayConvoId,
        provider: currentModel.label,
        modelName: currentModel.value,
        image: imageToSend,
      });

      const updatedMessages = [
        ...newMessages,
        { sender: "ai" as const, text: ai_res.aiResponse, image: "" },
      ];

      if (!expandedChat && setExpandedChat) {
        await performSmoothResize(600, 580, 160);
        await performSmoothResize(600, 570, 160);
        setExpandedChat(true);
      }

      setMessages(updatedMessages);
      setCurrResponse(ai_res.aiResponse);
      setIsTyping(true);
      setTypingText("");

      if (overlayConvoId === -1) {
        setOverlayChatTitle(ai_res.title);
        setOverlayConvoId(ai_res.conversationId);
      }
    } catch (error) {
      console.error("Error getting web search response:", error);
      const errorMessages = [
        ...newMessages,
        { sender: "ai" as const, text: "Sorry, I encountered an error with web search.", image: "" },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      setIsAIThinking(false);
    }
  };

  // Handler for supermemory
  const handleSupermemory = async (userMsg: string, manualImage?: string) => {
    if (!userMsg.trim()) return;

    // Stop any ongoing typing animation
    setIsTyping(false);
    setTypingText("");
    if (typingRef.current.animationId !== null) {
      cancelAnimationFrame(typingRef.current.animationId);
      typingRef.current.animationId = null;
    }

    const newMessages = [
      ...messages,
      { sender: "user" as const, text: userMsg, image: attachedImage || windowScreenshot || "" }, // Normal message without prefix
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);

    setIsAIThinking(true);

    // Use manual image if provided, otherwise use window screenshot
    const imageToSend = manualImage || windowScreenshot || "";

    try {
      const ai_res = await GenerateWithSupermemory({
        email: email,
        message: userMsg,
        newConvo: overlayConvoId === -1,
        conversationId: overlayConvoId,
        provider: currentModel.label,
        modelName: currentModel.value,
        image: imageToSend,
      });

      const updatedMessages = [
        ...newMessages,
        { sender: "ai" as const, text: ai_res.aiResponse, image: "" },
      ];

      if (!expandedChat && setExpandedChat) {
        await performSmoothResize(600, 580, 160);
        await performSmoothResize(600, 570, 160);
        setExpandedChat(true);
      }

      setMessages(updatedMessages);
      setCurrResponse(ai_res.aiResponse);
      setIsTyping(true);
      setTypingText("");

      if (overlayConvoId === -1) {
        setOverlayChatTitle(ai_res.title);
        setOverlayConvoId(ai_res.conversationId);
      }
    } catch (error) {
      console.error("Error getting supermemory response:", error);
      const errorMessages = [
        ...newMessages,
        { sender: "ai" as const, text: "Sorry, I encountered an error with memory search.", image: "" },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      setIsAIThinking(false);
    }
  };

  const handleSendMessage = () => {
    const userMsg = chatInputText.trim();
    if (!userMsg) return;

    setChatInputText("");
    setIsInputTyping(false);

    // Use selected tool if any
    if (selectedTool === 1) {
      handleWebSearch(userMsg, attachedImage || undefined);
    } else if (selectedTool === 2) {
      handleSupermemory(userMsg, attachedImage || undefined);
    } else {
      handleAIResponse(userMsg, attachedImage || undefined);
    }

    // Reset tool selection and image after sending
    setSelectedTool(0);
    setAttachedImage(null);
    setImagePreview(null);
  };

  const handleExpandChat = async () => {
    if (expandedChat) {
      // Collapsing - use delayed resize to match animation timing
      setTimeout(async () => {
        await performSmoothResize(500, 480, 200);
        await performSmoothResize(480, 470, 200);
      }, animations.overlayExpand * 1000);
    } else {
      // Expanding - immediate resize
      await performSmoothResize(600, 580, 160);
      await performSmoothResize(600, 570, 160);
    }
    setExpandedChat(!expandedChat);
  };

  const getCurrentTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleInject = async () => {
    await invoke("inject_text_to_window_by_title", {
      text: currResponse,
      windowTitle: windowName,
    });
  };

  return (
    <motion.div
      initial={{ y: "-100%" }}
      animate={{ y: "0%" }}
      exit={{ y: "-100%" }}
      transition={{ duration: animations.overlayChat, ease: "circInOut" }}
      ref={chatContainerRef}
      className="no-drag flex flex-col overflow-hidden  relative min-h-[400px] z-[1000] rounded-xl shadow-lg mt-2"
    >
      <div className="flex-1 flex flex-col overflow-hidden text-foreground dark:bg-[#010101] min-h-[300px] relative transition-all duration-200">
        {/* Chat header */}
        <div className="h-fit items-center border-b-2 overflow-hidden border-b-border/20 w-full flex">
          <div className="h-full w-full flex justify-between items-center p-2 tracking-tight font-medium">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 text-foreground min-w-0 flex-1">
                {titleLoading ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="truncate">Generating title...</span>
                  </div>
                ) : (
                  <span className="truncate flex-1 px-2 text-sm">{overlayChatTitle}</span>
                )}
              </div>
              {/* Insert button next to chat title */}
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
                    title={`Insert text into ${windowName || "active window"}`}
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
            <div className="text-zinc-600 text-sm  font-medium shrink-0 ml-2">
              {getCurrentTime().toUpperCase()}
            </div>
          </div>
          <div className="flex ml-auto shrink-0 h-[44px] gap-1 p-1">
            <OverlayButton
              
              onClick={handleNewChat}
              title="New Chat"
            >
              <TrashIcon weight="bold" />
            </OverlayButton>
            <OverlayButton
              
              onClick={handleExpandChat}
              title="Open in main window"
            >
              {expandedChat == true ? (
                <ArrowsInSimpleIcon weight="bold"  />
              ) : (
                <ArrowsOutSimpleIcon weight="bold" />
              )}
            </OverlayButton>
             {/* <OverlayButton
              
              onClick={onClose}
              title="Open in main window"
            >
              <CaretDoubleUpIcon weight="bold" />
            </OverlayButton> */}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide relative flex flex-col">
          {loadingMessages && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
              <Loader2 className="animate-spin text-zinc-700" size={24} />
            </div>
          )}
          {messages.map((msg, idx) => {
            const isLastMessage = idx === messages.length - 1;
            const isTypingThisMessage =
              isTyping && msg.sender === "ai" && isLastMessage;
            const displayText = isTypingThisMessage ? typingText : msg.text;

            return (
              <div
                key={idx}
                className={`p-2 rounded-lg text-sm ${
                  msg.sender === "user"
                    ? "bg-foreground dark:bg-zinc-950 dark:text-white font-medium  self-end text-right ml-auto w-fit max-w-[70%]"
                    : "bg-zinc-200 dark:bg-zinc-950 dark:text-white  self-start text-left w-fit max-w-[450px]"
                }`}
              >
                {msg.sender === "ai" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:hidden prose-code:hidden">
                    {(() => {
                      try {
                        return (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              code: ({
                                className,
                                children,
                                ...props
                              }: any) => {
                                const inline = props.inline;
                                return (
                                  <CodeBlock
                                    className={className}
                                    inline={inline}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, "")}
                                  </CodeBlock>
                                );
                              },
                            }}
                          >
                            {displayText || ""}
                          </ReactMarkdown>
                        );
                      } catch (error) {
                        console.error("Markdown render error:", error);
                        // Fallback: Simple line break preservation
                        return (
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {displayText}
                          </div>
                        );
                      }
                    })()}
                  </div>
                ) : (
                  <div className="px-2 dark:text-zinc-300">{msg.text}</div>
                )}

                {/* Show image if exists */}
                {msg.image && (
                  <div className="mt-2">
                    <img
                      src={msg.image}
                      alt="User uploaded"
                      className="w-[200px] rounded-lg "
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Thinking Animation - Simple Pulsing Dot */}
          {isAIThinking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="self-start flex items-center justify-center"
            >
              <img
                src={animatedUnscreenGif}
                alt="AI thinking animation"
                className="w-10 h-10 object-cover"
              />
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area with overlay icons */}
        <div className="relative">
          {/* Typing Icons - appear when user is typing */}
          <AnimatePresence>
            {isInputTyping && chatInputText.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full right-4 mb-2 flex gap-2 z-10"
              >
                {/* Web Search Icon */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedTool(selectedTool === 1 ? 0 : 1)}
                  className={`rounded-full p-2 shadow-md transition-all duration-200 flex items-center justify-center ${
                    selectedTool === 1
                      ? "bg-blue-600 ring-2 ring-blue-400/50 shadow-blue-500/30"
                      : "bg-blue-500/90 hover:bg-blue-600 hover:shadow-blue-500/20"
                  } text-white backdrop-blur-sm border border-white/20`}
                  title={selectedTool === 1 ? "Web search active - click to deactivate" : "Activate web search"}
                >
                  <Globe size={16} />
                </motion.button>

                {/* Supermemory Icon */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedTool(selectedTool === 2 ? 0 : 2)}
                  className={`rounded-full p-2 shadow-md transition-all duration-200 flex items-center justify-center ${
                    selectedTool === 2
                      ? "bg-purple-600 ring-2 ring-purple-400/50 shadow-purple-500/30"
                      : "bg-purple-500/90 hover:bg-purple-600 hover:shadow-purple-500/20"
                  } text-white backdrop-blur-sm border border-white/20`}
                  title={selectedTool === 2 ? "Supermemory active - click to deactivate" : "Activate supermemory"}
                >
                  <Brain size={16} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-[50px]  text-foreground bg-background relative flex items-center shrink-0">
            <div className="relative h-full">
              {/* <button
                type="button"
                className={`shrink-0 w-[120px] whitespace-nowrap bg-background h-full border-r border-border px-4 text-sm gap-2 flex items-center justify-center font-medium text-foreground select-none transition-colors hover:bg-foreground/10 ${dropdownOpen ? "bg-foreground/10" : ""}`}
                onClick={() => setDropdownOpen((v) => !v)}
              >
                {currentModel.value}
                <ChevronDown size={16} />
              </button>
              {dropdownOpen && (
                <div className="absolute left-0 bottom-full z-10 mb-1 w-40 bg-background border border-border rounded shadow-lg">
                  {MODELS.map((model) => (
                    <button
                      key={model.value}
                      className={`w-full text-left px-4 py-2 text-sm text-foreground transition-colors hover:bg-foreground/10 ${
                        model.value === currentModel.value
                          ? "font-bold bg-foreground/10"
                          : ""
                      }`}
                      onClick={() => {
                        setCurrentModel(model);
                        setDropdownOpen(false);
                      }}
                    >
                      {model.value}
                    </button>
                  ))}
                </div>
              )} */}
            </div>
            <div className="w-full h-full py-1 pl-1">
              <div className="relative size-full dark:bg-zinc-950 focus-within:dark:bg-zinc-950 rounded-lg transition-all duration-100 border-2 dark:border-zinc-950 focus-within:dark:border-zinc-900">
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
                placeholder={attachedImage ? "Describe what you want to know about this image..." : "Enter your message or paste a screenshot"}
                className="w-full px-4 dark:focus:placeholder:text-zinc-400/0 placeholder:transition-colors h-full bg-transparent text-foreground placeholder:text-foreground/50 text-sm outline-none pr-12"
              />

              {/* Image attachment indicator */}
              <AnimatePresence>
                {imagePreview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <div className="relative group">
                      <img
                        src={imagePreview}
                        alt="Attached screenshot"
                        className="w-6 h-6 object-cover rounded  cursor-pointer"
                        title="Screenshot attached - Click to remove"
                        onClick={clearImage}
                      />
                      <button
                        onClick={clearImage}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
      </div>
    </motion.div>
  );
};