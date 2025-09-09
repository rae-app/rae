import {
  MouseEventHandler,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { useUserStore } from "@/store/userStore";
import { ChatMessage, useChatStore } from "@/store/chatStore";
import {
  Generate,
  GenerateWithWebSearch,
  GenerateWithSupermemory,
  BASE_URL,
} from "@/api/chat";
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
import {
  ArrowElbowDownLeftIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  BrainIcon,
  CaretDoubleUpIcon,
  CheckIcon,
  DotsThreeVerticalIcon,
  GearSixIcon,
  GlobeSimpleIcon,
  SlidersHorizontalIcon,
  SlidersIcon,
  TrashIcon,
} from "@phosphor-icons/react";
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
  isActive?: boolean;
}

const Option = ({
  icon,
  children,
  active,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex gap-2 text-sm w-full transition-colors duration-100 px-2 py-1 dark:text-zinc-400 font-medium hover:dark:text-white hover:dark:bg-zinc-900 ${
        active && "dark:!bg-surface dark:!text-white"
      } rounded-md items-center`}
    >
      {icon}
      {children}
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="ml-auto"
          transition={{ duration: 0.2, ease: "easeInOut", type: "tween" }}
        >
          <CheckIcon className="" weight="bold" />
        </motion.div>
      )}
    </button>
  );
};

// Utility function for smooth window resizing with easing
const performSmoothResize = async (
  targetWidth: number,
  targetHeight: number,
  duration: number = 160
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
        startWidth + (targetWidth - startWidth) * easedProgress
      );
      const currentHeight = Math.round(
        startHeight + (targetHeight - startHeight) * easedProgress
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

  windowScreenshot,
  isActive,
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
  const [streamingMsg, setStreamingMsg] = useState<string>("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  // Removed typing animation logic
  const [isInputTyping, setIsInputTyping] = useState(false);
  const [selectedTool, setSelectedTool] = useState<0 | 1 | 2>(0); // 0=none, 1=web search, 2=supermemory
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Refs for scrolling
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const handleStreamAIResponse = async (
    email,
    message,
    newConvo,
    conversationId,

    provider,
    modelName,
    image,
    tool,
    newMessages
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
      if (done) break;
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

    const newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg,
        image: attachedImage || windowScreenshot || "",
      },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);

    setIsAIThinking(true);

    const imageToSend = manualImage || (isActive ? windowScreenshot : "") || "";

    try {
      let ai_res;
      if (imageToSend == "") {
        await handleStreamAIResponse(
          email,

          userMsg,
          overlayConvoId === -1,
          overlayConvoId,
          currentModel.label,
          currentModel.value,
          "",
          selectedTool,
          newMessages
        );
      } else {
        ai_res = await Generate({
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
          image: "",
        },
      ];
      setMessages(errorMessages);
    } finally {
      setTitleLoading(false);
      setIsAIThinking(false);
      setStreamingMsg("");
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

  // Removed typing animation effect

  const handleNewChat = () => {
    setMessages([]);
    setOverlayChatTitle("New Chat");
    setOverlayConvoId(-1);
    setChatInputText("");
    setCurrResponse("");
    setIsInputTyping(false);
    setSelectedTool(0);
    setAttachedImage(null);
    setImagePreview(null);
  };

  // Handle image paste
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
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

    const newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg,
        image: attachedImage || windowScreenshot || "",
      },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);

    setIsAIThinking(true);

    const imageToSend = manualImage || (isActive ? windowScreenshot : "") || "";

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
          image: "",
        },
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

    const newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg,
        image: attachedImage || windowScreenshot || "",
      },
    ];
    setMessages(newMessages);
    if (overlayConvoId === -1) setTitleLoading(true);

    setIsAIThinking(true);

    const imageToSend = manualImage || (isActive ? windowScreenshot : "") || "";

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
          image: "",
        },
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

    if (selectedTool === 1) {
      handleWebSearch(userMsg, attachedImage || undefined);
    } else if (selectedTool === 2) {
      handleSupermemory(userMsg, attachedImage || undefined);
    } else {
      handleAIResponse(userMsg, attachedImage || undefined);
    }

    setSelectedTool(0);
    setAttachedImage(null);
    setImagePreview(null);
  };

  const getCurrentTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleInject = async () => {
    await invoke("inject_text_to_window_by_title", {
      text: currResponse,
      windowTitle: windowName,
    });
  };

  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <motion.div
      onClick={() => {
        setOptionsOpen(false);
      }}
      initial={{ y: "-100%" }}
      animate={{ y: "0%" }}
      exit={{ y: "-100%" }}
      transition={{ duration: animations.overlayChat, ease: "circInOut" }}
      ref={chatContainerRef}
      className="no-drag flex flex-col overflow-hidden  relative min-h-[400px] z-[1000] rounded-xl shadow-lg mt-2"
    >
      <div className="flex-1 flex flex-col overflow-hidden text-foreground dark:bg-[#010101] bg-white min-h-[300px] relative transition-all duration-200">
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
                  <span className="truncate flex-1 px-2 text-sm">
                    {overlayChatTitle}
                  </span>
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
            <OverlayButton onClick={handleNewChat} title="New Chat">
              <TrashIcon weight="bold" />
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
          {/* Render all messages except the streaming one */}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg text-sm ${
                msg.sender === "user"
                  ? "bg-foreground dark:bg-zinc-950 dark:text-white font-medium  self-end text-right ml-auto w-fit max-w-[70%]"
                  : "bg-zinc-200 dark:bg-zinc-950 dark:text-white  self-start text-left w-fit max-w-[300px]"
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
                            code: ({ className, children, ...props }: any) => {
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
                          {msg.text || ""}
                        </ReactMarkdown>
                      );
                    } catch (error) {
                      console.error("Markdown render error:", error);
                      return (
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
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
          ))}

          {/* Streaming AI message (if any) */}
          {streamingMsg && (
            <div className="p-2 rounded-lg text-sm bg-zinc-200 dark:bg-zinc-950 dark:text-white self-start text-left w-fit max-w-[300px]">
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:hidden prose-code:hidden">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    code: ({ className, children, ...props }: any) => {
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
                  {streamingMsg}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* AI Thinking Animation - Simple Pulsing Dot */}
          <AnimatePresence mode="popLayout">
            {isAIThinking && (
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
                        <button className="flex gap-2 text-sm w-full transition-colors duration-100 px-2 py-1 dark:text-zinc-400 font-medium hover:dark:text-white hover:dark:bg-zinc-900 rounded-md items-center">
                          <GearSixIcon className="text-lg" />
                          More Settings
                        </button>
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
            <div className="w-full h-full py-1 ">
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
                  placeholder={
                    attachedImage
                      ? "Describe what you want to know about this image..."
                      : "Enter your message or paste a screenshot"
                  }
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
