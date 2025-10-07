import {
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { useUserStore } from "@/store/userStore";
import { ChatMessage, useChatStore } from "@/store/chatStore";
import {
  Generate,
  GenerateWithWebSearch,
  GenerateWithSupermemory,
  GenerateImage,
  BASE_URL,
} from "@/api/chat";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Minimize2,
  Maximize2,
  Globe,
  Brain,
  Image,
  Plus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import CodeBlock from "@/components/misc/CodeBlock";

import { animations } from "@/constants/animations";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/store/noteStore";
import { extractInsertableContent, InsertionContext, generateContextAwarePrompt } from "@/utils/textExtraction";
import WebSearchAnimation from "./WebSearchAnimation";
// Passing OpenAI logo SVG as a data URL
const openaiLogo = `data:image/svg+xml;base64,${btoa(`<svg width="721" height="721" viewBox="0 0 721 721" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1637_2934)">
<g clip-path="url(#clip1_1637_2934)">
<path d="M304.246 294.611V249.028C304.246 245.189 305.687 242.309 309.044 240.392L400.692 187.612C413.167 180.415 428.042 177.058 443.394 177.058C500.971 177.058 537.44 221.682 537.44 269.182C537.44 272.54 537.44 276.379 536.959 280.218L441.954 224.558C436.197 221.201 430.437 221.201 424.68 224.558L304.246 294.611ZM518.245 472.145V363.224C518.245 356.505 515.364 351.707 509.608 348.349L389.174 278.296L428.519 255.743C431.877 253.826 434.757 253.826 438.115 255.743L529.762 308.523C556.154 323.879 573.905 356.505 573.905 388.171C573.905 424.636 552.315 458.225 518.245 472.141V472.145ZM275.937 376.182L236.592 353.152C233.235 351.235 231.794 348.354 231.794 344.515V238.956C231.794 187.617 271.139 148.749 324.4 148.749C344.555 148.749 363.264 155.468 379.102 167.463L284.578 222.164C278.822 225.521 275.942 230.319 275.942 237.039V376.186L275.937 376.182ZM360.626 425.122L304.246 393.455V326.283L360.626 294.616L417.002 326.283V393.455L360.626 425.122ZM396.852 570.989C376.698 570.989 357.989 564.27 342.151 552.276L436.674 497.574C442.431 494.217 445.311 489.419 445.311 482.699V343.552L485.138 366.582C488.495 368.499 489.936 371.379 489.936 375.219V480.778C489.936 532.117 450.109 570.985 396.852 570.985V570.989ZM283.134 463.99L191.486 411.211C165.094 395.854 147.343 363.229 147.343 331.562C147.343 294.616 169.415 261.509 203.48 247.593V356.991C203.48 363.71 206.361 368.508 212.117 371.866L332.074 441.437L292.729 463.99C289.372 465.907 286.491 465.907 283.134 463.99ZM277.859 542.68C223.639 542.68 183.813 501.895 183.813 451.514C183.813 447.675 184.294 443.836 184.771 439.997L279.295 494.698C285.051 498.056 290.812 498.056 296.568 494.698L417.002 425.127V470.71C417.002 474.549 415.562 477.429 412.204 479.346L320.557 532.126C308.081 539.323 293.206 542.68 277.854 542.68H277.859ZM396.852 599.776C454.911 599.776 503.37 558.513 514.41 503.812C568.149 489.896 602.696 439.515 602.696 388.176C602.696 354.587 588.303 321.962 562.392 298.45C564.791 288.373 566.231 278.296 566.231 268.224C566.231 199.611 510.571 148.267 446.274 148.267C433.322 148.267 420.846 150.184 408.37 154.505C386.775 133.392 357.026 119.958 324.4 119.958C266.342 119.958 217.883 161.22 206.843 215.921C153.104 229.837 118.557 280.218 118.557 331.557C118.557 365.146 132.95 397.771 158.861 421.283C156.462 431.36 155.022 441.437 155.022 451.51C155.022 520.123 210.682 571.466 274.978 571.466C287.931 571.466 300.407 569.549 312.883 565.228C334.473 586.341 364.222 599.776 396.852 599.776Z" fill="black"/>
</g>
</g>
<defs>
<clipPath id="clip0_1637_2934">
<rect width="720" height="720" fill="white" transform="translate(0.606934 0.0999756)"/>
</clipPath>
<clipPath id="clip1_1637_2934">
<rect width="484.139" height="479.818" fill="white" transform="translate(118.557 119.958)"/>
</clipPath>
</defs>
</svg>`)}`;
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

  const { notes } = useNoteStore();

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

  // Helper to get the images to preview/send, always including windowScreenshot if isActive (analysis mode)
  const getImagesToSend = () => {
    let imgs = attachedImages;
    console.log("📸 getImagesToSend called:", {
      isActive,
      hasWindowScreenshot: !!windowScreenshot,
      windowScreenshotLength: windowScreenshot?.length || 0,
      attachedImagesCount: attachedImages.length
    });
    // If analysis is on and windowScreenshot exists, ensure it's included (but not duplicated)
    if (isActive && windowScreenshot) {
      if (!imgs.includes(windowScreenshot)) {
        console.log("✅ Adding windowScreenshot to images array");
        imgs = [windowScreenshot, ...imgs];
      } else {
        console.log("ℹ️ windowScreenshot already in images array");
      }
    } else if (isActive && !windowScreenshot) {
      console.log("⚠️ isActive is true but windowScreenshot is empty");
    }
    // Limit to 3 images
    const result = imgs.slice(0, 3);
    console.log(`📤 Returning ${result.length} images to send`);
    return result;
  };
  const [stealthMode, setStealthMode] = useState<boolean>(false);
  const [lastImage, setLastImage] = useState<string>("");
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(
    null,
  );
  const [imageReferenced, setImageReferenced] = useState<boolean>(false);
  const [showScreenshotPreview, setShowScreenshotPreview] = useState<boolean>(false);
  
  // Debug effect to monitor screenshot preview state
  useEffect(() => {
    console.log("🔍 Screenshot Preview State Changed:", {
      showScreenshotPreview,
      hasWindowScreenshot: !!windowScreenshot,
      windowScreenshotLength: windowScreenshot?.length,
      hasCurrResponse: !!(currResponse && currResponse.trim())
    });
  }, [showScreenshotPreview, windowScreenshot, currResponse]);
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
    console.log("Starting streaming request with tool:", tool);
    console.log("Request parameters:", { email, message, newConvo, conversationId, provider, modelName, tool });
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

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);
    console.log("Starting streaming connection...");
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("ReadableStream not supported in this environment.");
    }
    console.log("Reader obtained, starting to read stream...");
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream finished");
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      console.log("Raw chunk received:", chunk);
      chunk.split("\n\n").forEach((event) => {
        if (!event.trim()) return;
        const dataLine = event.replace(/^data:\s*/, "");
        try {
          const data = JSON.parse(dataLine);
          if (data.type === "chunk") {
            console.log("Frontend received chunk:", data.content);
            fullText += data.content;
            console.log("fullText length now:", fullText.length);
            setStreamingMsg((prev) => prev + data.content);
          } else if (data.type == "title") {
            if (overlayConvoId === -1) {
              setOverlayChatTitle(data.title);
              setOverlayConvoId(data.conversationId);
            }
            // Optionally handle title
          } else if (data.type === "search_site_found") {
            // Handle real-time search progress
            console.log("Frontend received search_site_found:", data);
            console.log("Window has addRealSearchSite:", !!(window as any).addRealSearchSite);
            if ((window as any).addRealSearchSite) {
              console.log("Calling addRealSearchSite with:", {
                site: data.site,
                domain: data.domain,
                favicon: data.favicon,
                title: data.title,
                link: data.link
              });
              try {
                (window as any).addRealSearchSite({
                  site: data.site,
                  domain: data.domain,
                  favicon: data.favicon,
                  title: data.title,
                  link: data.link
                });
                console.log("addRealSearchSite called successfully");
              } catch (error) {
                console.error("Error calling addRealSearchSite:", error);
              }
            } else {
              console.log("addRealSearchSite function not found on window");
            }
          } else if (data.type === "done") {
            // Stream complete
            console.log("Frontend received 'done' event, fullText length:", fullText.length);
            console.log("fullText content preview:", fullText.substring(0, 100) + "...");
            setStreamingMsg("");
            setCurrResponse(fullText);
            // Add final message to chat
            // Only append AI message, do not overwrite user message
            console.log("Adding AI message to chat, current messages count:", newMessages.length);
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
    // Create context for smart AI prompting
    const insertionContext: InsertionContext = {
      windowName,
      windowScreenshot: windowScreenshot || undefined,
    };
    // Enhance the user message with context for better AI responses
    const contextAwareMessage = generateContextAwarePrompt(userMsg, insertionContext);
    console.log("handleAIResponse: Processing message with context:", {
      originalMessage: userMsg,
      contextAwareMessage: contextAwareMessage,
      windowName,
      detectedContext: insertionContext.detectedContext,
      manualImageLength: manualImage ? 1 : 0,
      attachedImagesLength: attachedImages.length,
      attachedFilesLength: attachedFiles.length,
      windowScreenshotLength: windowScreenshot?.length || 0,
      imagesToSendLength: imagesToSend.length,
    });
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
      console.log("Setting web search animation state");
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
        console.log("🔧 About to call handleStreamAIResponse with selectedTool:", selectedTool);
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
      console.log("📨 ChatCard: Received initial message:", {
        message: initialMessage,
        hasImage: !!initialAttachedImage,
        imageLength: initialAttachedImage?.length || 0,
      });

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
            setAttachedImages((prev) => {
              if (prev.length >= 3) return prev;
              return [...prev, base64];
            });
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // Clear attached image
  const clearImage = (idx: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle file selection
  const handleFileSelect = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "*/*"; // Allow all file types

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach((file) => {
          // Check file size (limit to 10MB)
          if (file.size > 10 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Maximum size is 10MB.`);
            return;
          }

          const reader = new FileReader();

          // For text files, also store the text content
          if (
            file.type.startsWith("text/") ||
            file.name.toLowerCase().endsWith(".txt") ||
            file.name.toLowerCase().endsWith(".js") ||
            file.name.toLowerCase().endsWith(".ts") ||
            file.name.toLowerCase().endsWith(".py") ||
            file.name.toLowerCase().endsWith(".json") ||
            file.name.toLowerCase().endsWith(".md") ||
            file.name.toLowerCase().endsWith(".html") ||
            file.name.toLowerCase().endsWith(".css") ||
            file.name.toLowerCase().endsWith(".xml")
          ) {
            const textReader = new FileReader();
            textReader.onload = (textEvent) => {
              const textContent = textEvent.target?.result as string;
              const base64Reader = new FileReader();
              base64Reader.onload = (base64Event) => {
                const base64 = base64Event.target?.result as string;
                setAttachedFiles((prev) => {
                  if (prev.length >= 5) return prev; // Limit to 5 files
                  return [
                    ...prev,
                    {
                      name: file.name,
                      type: file.type,
                      size: file.size,
                      content: base64,
                      textContent: textContent,
                    },
                  ];
                });
              };
              base64Reader.readAsDataURL(file);
            };
            textReader.readAsText(file);
          } else {
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              setAttachedFiles((prev) => {
                if (prev.length >= 5) return prev; // Limit to 5 files
                return [
                  ...prev,
                  {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    content: base64,
                  },
                ];
              });
            };
            reader.readAsDataURL(file);
          }
        });
      }
    };

    input.click();
  };

  // Clear attached file
  const clearFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

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
    setAttachedImages((prev) => {
      if (prev.length >= 3) return prev;
      return [...prev, imageBase64];
    });

    // If not already on image generation tool, switch to it for better workflow
    // if (selectedTool !== 4) {
    //   setSelectedTool(4);
    // }

    setImageReferenced(true);
    // Clear the notification after 3 seconds for image generation, 2 for others
    const timeout = selectedTool === 4 ? 3000 : 2000;
    setTimeout(() => setImageReferenced(false), timeout);
  };

  // Handler for web search
  const handleWebSearch = async (userMsg: string, manualImage?: string) => {
    if (!userMsg.trim()) return;

    // Create context for web search
    const insertionContext: InsertionContext = {
      windowName,
      windowScreenshot: windowScreenshot || undefined,
    };
    const contextAwareMessage = generateContextAwarePrompt(userMsg, insertionContext);
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

    // Create context for supermemory
    const insertionContext: InsertionContext = {
      windowName,
      windowScreenshot: windowScreenshot || undefined,
    };
    const contextAwareMessage = generateContextAwarePrompt(userMsg, insertionContext);
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
      console.log("Web search tool selected, using streaming implementation");
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

  const getCurrentTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });


  const handleInject = async () => {
    try {
      console.log("Starting injection...");
      console.log("currResponse:", currResponse);
      console.log("windowName:", windowName);
      console.log("windowHwnd:", windowHwnd);
      
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
      
      console.log("insertionContext:", insertionContext);
      
      const insertableText = extractInsertableContent(currResponse, insertionContext);
      console.log("Original currResponse:", currResponse);
      console.log("Insertion context:", insertionContext);
      console.log("Extracted insertableText:", insertableText);
      
      if (!insertableText) {
        console.warn("No insertable text extracted, using original response");
        await invoke("inject_text_to_window_by_hwnd", {
          text: currResponse,
          hwnd: windowHwnd,
        });
      } else {
        console.log("Injecting extracted text");
        await invoke("inject_text_to_window_by_hwnd", {
          text: insertableText,
          hwnd: windowHwnd,
        });
      }
      
      console.log("Injection completed");
    } catch (error) {
      console.error("Injection failed:", error);
    }
  };

  const [optionsOpen, setOptionsOpen] = useState(false);

  // Simple page components for maximized state
  const renderPageContent = () => {
    switch (currentPage) {
      case "chat":
        return null; // Return null to show the regular chat content
      case "settings":
        return (
          <div
            className={`text-foreground overflow-y-auto ${
              isMaximized ? "w-full px-6 py-4 mt-2" : "flex-1 p-4"
            }`}
            style={isMaximized ? { height: "calc(100vh - 80px)" } : {}}
          >
            <h2 className="text-xl font-semibold mb-6">Settings</h2>
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <h3 className="font-medium mb-2">Preferences</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Configure your app preferences here
                </p>
              </div>
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <h3 className="font-medium mb-2">Shortcuts</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Manage keyboard shortcuts
                </p>
              </div>
            </div>
          </div>
        );
      case "notes":
        return (
          <div
            className={`text-foreground overflow-y-auto ${
              isMaximized ? "w-full px-6 py-4 mt-2" : "flex-1 p-4"
            }`}
            style={isMaximized ? { height: "calc(100vh - 80px)" } : {}}
          >
            <h2 className="text-xl font-semibold mb-6">Notes</h2>
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <h3 className="font-medium mb-2">Your Notes</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Access and manage your notes
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      onClick={() => {
        setOptionsOpen(false);
      }}
      initial={{  opacity: 1, y:"-100%" }}
      animate={{  opacity: 1, y:"0%" }}
      exit={{  opacity: 0, y:"-100%" }}
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
            {renderPageContent()}
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
                <div className="flex items-center gap-2 ml-2 relative no-drag">
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
                        onMouseEnter={() => {
                          console.log("Mouse entered Insert button");
                          console.log("windowScreenshot exists:", !!windowScreenshot);
                          console.log("windowScreenshot length:", windowScreenshot?.length);
                          console.log("showScreenshotPreview will be set to:", true);
                          setShowScreenshotPreview(true);
                        }}
                        onMouseLeave={() => {
                          console.log("Mouse left Insert button");
                          setShowScreenshotPreview(false);
                        }}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        className="no-drag shrink-0 bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 backdrop-blur-sm border border-white/40 dark:border-white/20 text-foreground px-2 py-1 rounded-md shadow-sm hover:shadow-md flex items-center gap-1 transition-all duration-200 relative cursor-pointer"
                        title={`Insert text into ${
                          windowName || "active window"
                        }`}
                      >
                        {windowIcon ? (
                          <img
                            src={windowIcon}
                            alt="App icon"
                            className="w-4 h-4 rounded-sm flex-shrink-0 pointer-events-none"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-4 h-4 bg-gray-300 rounded-sm flex-shrink-0 flex items-center justify-center text-xs pointer-events-none">
                            ?
                          </div>
                        )}
                        <span className="text-xs font-medium whitespace-nowrap pointer-events-none">
                          Insert
                        </span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  
                  {/* Screenshot Preview on Hover */}
                  {showScreenshotPreview && windowScreenshot && currResponse && currResponse.trim() ? (
                    <div
                      className="fixed top-20 right-20 z-[9999] pointer-events-none bg-red-500 p-4"
                      style={{ zIndex: 99999 }}
                    >
                      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border-2 border-red-500 overflow-hidden">
                        <div className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {windowName || "Window Preview"} - DEBUG MODE
                          </p>
                        </div>
                        <img
                          src={windowScreenshot}
                          alt="Window screenshot"
                          className="max-w-[300px] max-h-[200px] object-contain"
                          draggable={false}
                        />
                      </div>
                    </div>
                  ) : null}
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
                                return (
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkBreaks]}
                                    components={{
                                      p: ({ children }) => (
                                        <p className="mb-3 last:mb-0 leading-7 text-[15px]">
                                          {children}
                                        </p>
                                      ),
                                      h1: ({ children }) => (
                                        <h1 className="text-xl font-semibold mb-3 mt-6 first:mt-0 text-foreground dark:text-white">
                                          {children}
                                        </h1>
                                      ),
                                      h2: ({ children }) => (
                                        <h2 className="text-lg font-semibold mb-3 mt-5 first:mt-0 text-foreground dark:text-white">
                                          {children}
                                        </h2>
                                      ),
                                      h3: ({ children }) => (
                                        <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0 text-foreground dark:text-white">
                                          {children}
                                        </h3>
                                      ),
                                      ul: ({ children }) => (
                                        <ul className="list-disc list-inside mb-3 space-y-1 ml-2">
                                          {children}
                                        </ul>
                                      ),
                                      ol: ({ children }) => (
                                        <ol className="list-decimal list-inside mb-3 space-y-1 ml-2">
                                          {children}
                                        </ol>
                                      ),
                                      li: ({ children }) => (
                                        <li className="text-[15px] leading-6 ml-2">
                                          {children}
                                        </li>
                                      ),
                                      blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 py-2 mb-3 italic text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 rounded-r">
                                          {children}
                                        </blockquote>
                                      ),
                                      strong: ({ children }) => (
                                        <strong className="font-semibold text-foreground dark:text-white">
                                          {children}
                                        </strong>
                                      ),
                                      em: ({ children }) => (
                                        <em className="italic text-foreground dark:text-zinc-200">
                                          {children}
                                        </em>
                                      ),
                                      a: ({ href, children }) => (
                                        <a
                                          href={href}
                                          className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          {children}
                                        </a>
                                      ),
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
                                    {msg.text || ""}
                                  </ReactMarkdown>
                                );
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
                        <div className="text-[15px] leading-6 font-medium">{msg.text}</div>
                      )}

                  {/* Show image if exists */}
                  {msg.image && msg.image.filter((img: string) => img.trim() !== "").length > 0 && (
  <div className="mt-2 flex flex-col gap-2">
    {msg.image
      .filter((img: string) => img.trim() !== "")
      .map((img: string, imgIdx: number) => (
        <div
          key={imgIdx}
          className="relative inline-block"
          onMouseEnter={() =>
            msg.sender === "ai" ? setHoveredImageIndex(idx) : null
          }
          onMouseLeave={() => setHoveredImageIndex(null)}
        >
          <img
            src={img}
            alt={msg.sender === "user" ? "User uploaded" : "AI generated"}
            className={`max-w-full rounded-lg border border-gray-300 transition-all duration-200 ${
              msg.sender === "ai"
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg"
                : ""
            }`}
          />

          {/* Hover overlay only for AI images */}
          {msg.sender === "ai" && hoveredImageIndex === idx && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center transition-all duration-200 animate-in fade-in-0">
              <button
                onClick={() => handleReferenceImage(img)}
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
                {selectedTool === 4 ? "Modify" : "Reference"}
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
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-3 last:mb-0 leading-7 text-[15px]">
                                  {children}
                                </p>
                              ),
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
                {isAIThinking && !isWebSearching && !isImageGenerating && streamingMsg.length === 0 && (
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
                              if (isActive && windowScreenshot && img === windowScreenshot) return;
                              clearImage(idx);
                            }}
                            className="relative group h-[90px] w-[120px] border-2 border-border hover:border-surface/40 group transition-colors cursor-pointer overflow-hidden rounded-sm flex items-center justify-center"
                          >
                            <img
                              src={img}
                              alt={`Attached screenshot ${idx + 1}`}
                              className="size-full object-cover absolute left-0 top-0  z-10 cursor-pointer"
                              title={`Screenshot ${idx + 1} attached${isActive && windowScreenshot && img === windowScreenshot ? ' (analysis)' : ''}${isActive && windowScreenshot && img === windowScreenshot ? ' (cannot remove)' : ' - Click to remove'}`}
                              onClick={() => {
                                if (isActive && windowScreenshot && img === windowScreenshot) return;
                                clearImage(idx);
                              }}
                            />
                            <TrashSimpleIcon weight="bold" className={`z-40 text-white group-hover:opacity-100 opacity-0 transition-all${isActive && windowScreenshot && img === windowScreenshot ? ' hidden' : ''}`} />
                            <div
                              className="absolute group-hover:opacity-100 opacity-0 transition-all z-30 blur-xl -bottom-1/2 left-1/2 -translate-x-1/2  rounded-full pointer-events-auto bg-surface/70 size-[90px] flex items-center justify-center"
                            ></div>
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
                              className="z-40 text-white group-hover:opacity-100 opacity-0 transition-all absolute"
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
