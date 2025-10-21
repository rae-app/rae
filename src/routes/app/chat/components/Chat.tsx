import React, { useEffect, useRef, useState } from "react";
import autosize from "autosize";
import {
  ChevronDown,
  Send,
  Globe,
  Brain,
  Image,
  X,
  Wrench,
  Plus,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowElbowDownLeftIcon,
  CheckIcon,
  GlobeSimpleIcon,
  BrainIcon,
  TrashSimpleIcon,
} from "@phosphor-icons/react";
import { useUserStore } from "@/store/userStore";

// Message Handler Manager - handles different types of message sending
const createMessageHandler = (
  message: string,
  attachedImages: string[],
  attachedFiles: any[],
  init: boolean,
  setMessage: (msg: string) => void,
  setIsTyping: (typing: boolean) => void,
  setAttachedImages: (images: string[]) => void,
  setAttachedFiles: (files: any[]) => void,
  setInit?: (init: boolean) => void,
  onSend?: (msg: string, images?: string[], files?: any[]) => void,
  onWebSearch?: (msg: string, images?: string[], files?: any[]) => void,
  onSupermemory?: (msg: string, images?: string[], files?: any[]) => void,
  onImageGeneration?: (msg: string, images?: string[], files?: any[]) => void,
) => {
  const resetInputs = () => {
    setMessage("");
    setIsTyping(false);
    setAttachedImages([]);
    setAttachedFiles([]);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    if (onSend) {
      onSend(
        message,
        attachedImages.length > 0 ? attachedImages.slice(0, 3) : undefined,
        attachedFiles.length > 0 ? attachedFiles : undefined,
      );
    }
    resetInputs();
  };

  const handleWebSearch = () => {
    if (!message.trim()) return;
    if (onWebSearch) {
      onWebSearch(
        message,
        attachedImages.length > 0 ? attachedImages.slice(0, 3) : undefined,
        attachedFiles.length > 0 ? attachedFiles : undefined,
      );
    }
    resetInputs();
  };

  const handleSupermemory = () => {
    if (!message.trim()) return;
    if (!init && setInit) setInit(true);
    if (onSupermemory) {
      onSupermemory(
        message,
        attachedImages.length > 0 ? attachedImages.slice(0, 3) : undefined,
        attachedFiles.length > 0 ? attachedFiles : undefined,
      );
    }
    resetInputs();
  };

  const handleImageGeneration = () => {
    if (!message.trim()) return;
    if (onImageGeneration) {
      onImageGeneration(
        message,
        attachedImages.length > 0 ? attachedImages.slice(0, 3) : undefined,
        attachedFiles.length > 0 ? attachedFiles : undefined,
      );
    }
    resetInputs();
  };

  const handleSendMessage = (selectedTool: number) => {
    if (selectedTool === 1) {
      handleWebSearch();
    } else if (selectedTool === 2) {
      handleSupermemory();
    } else if (selectedTool === 4) {
      handleImageGeneration();
    } else {
      handleSend();
    }
  };

  return {
    handleSend,
    handleWebSearch,
    handleSupermemory,
    handleImageGeneration,
    handleSendMessage,
  };
};

// File Manager - handles file operations
const createFileManager = (
  setAttachedFiles: React.Dispatch<React.SetStateAction<any[]>>,
) => {
  const clearFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

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

  return {
    clearFile,
    handleFileSelect,
  };
};

// Image Manager - handles image operations
const createImageManager = (
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>,
  onReferenceImage?: (imageBase64: string) => void,
) => {
  const clearImage = (idx?: number) => {
    if (typeof idx === "number") {
      setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
    }
  };

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
              if (prev.includes(base64)) return prev;
              return prev.length < 3 ? [...prev, base64] : prev;
            });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleReferenceImage = (imageBase64: string) => {
    // Create a custom event to communicate with ChatInput component
    const event = new CustomEvent("referenceImage", {
      detail: { imageBase64, shouldSwitchTool: false },
    });
    window.dispatchEvent(event);
  };

  return {
    clearImage,
    handlePaste,
    handleReferenceImage,
  };
};

// UI State Manager - handles UI state operations
const createUIStateManager = (
  attachedImages: string[],
  attachedFiles: any[],
  setDisabled: (disabled: boolean) => void,
  setExpanded: (expanded: boolean) => void,
  setIsTyping: (typing: boolean) => void,
  setToolsDropdownOpen: (open: boolean) => void,
  onTypingChange?: (typing: boolean) => void,
  onMessageChange?: (message: string) => void,
) => {
  const handleInputChange = (value: string) => {
    setDisabled(value.trim() === "");
    const typing = value.length > 0;
    setIsTyping(typing);
    if (onTypingChange) {
      onTypingChange(typing);
    }
    if (onMessageChange) {
      onMessageChange(value);
    }
  };

  const getPlaceholderText = (selectedTool: number) => {
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
        return "Enter your message ";
    }
  };

  return {
    handleInputChange,
    getPlaceholderText,
  };
};
// OpenAI logo SVG as a data URL
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
const defaultModels = [
  { label: "OpenAi", value: "gpt-4o-mini" },
  { label: "OpenAi", value: "gpt-4o" },
  // { label: "Gemini", value: "gemini-2.5-flash" },
];

interface ChatProps {
  name: string;
  onSend?: (
    msg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => void;
  onWebSearch?: (
    msg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => void;
  onSupermemory?: (
    msg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => void;
  onImageGeneration?: (
    msg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => void;
  currentModel?: { label: string; value: string };
  setCurrentModel?: (model: { label: string; value: string }) => void;
  models?: { label: string; value: string }[];
  initialMessage?: string | null;
  onTypingChange?: (isTyping: boolean) => void;
  onMessageChange?: (message: string) => void;
  selectedTool?: 0 | 1 | 2 | 4;
  onToolChange?: (tool: 0 | 1 | 2 | 4) => void;
  initial?: boolean;
  onReferenceImage?: (imageBase64: string) => void;
}

const Chat: React.FC<ChatProps> = ({
  name,
  onSend,
  onWebSearch,
  onSupermemory,
  onImageGeneration,
  currentModel,
  setCurrentModel,
  models: modelsProp,
  initialMessage,
  onTypingChange,
  onMessageChange,
  selectedTool = 0,
  onToolChange,
  initial = false,
  onReferenceImage,
}) => {
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState(initialMessage || "");
  const [disabled, setDisabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<
    {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[]
  >([]);
  const [init, setInit] = useState(initial);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef2 = useRef<HTMLDivElement>(null);
  // If initial prop changes, update init accordingly
  useEffect(() => {
    setInit(initial);
  }, [initial]);

  // Initialize managers
  const messageHandler = createMessageHandler(
    message,
    attachedImages,
    attachedFiles,
    init,
    setMessage,
    setIsTyping,
    setAttachedImages,
    setAttachedFiles,
    setInit,
    onSend,
    onWebSearch,
    onSupermemory,
    onImageGeneration,
  );

  const fileManager = createFileManager(setAttachedFiles);
  const imageManager = createImageManager(setAttachedImages, onReferenceImage);
  const uiStateManager = createUIStateManager(
    attachedImages,
    attachedFiles,
    setDisabled,
    setExpanded,
    setIsTyping,
    setToolsDropdownOpen,
    onTypingChange,
    onMessageChange,
  );

  // Close tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        toolsDropdownRef.current &&
        !toolsDropdownRef.current.contains(event.target as Node) &&
        toolsDropdownRef2.current &&
        !toolsDropdownRef2.current.contains(event.target as Node)
      ) {
        setToolsDropdownOpen(false);
      }
    };

    if (toolsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [toolsDropdownOpen]);

  // Use local model state if not controlled
  const modelsList = modelsProp || defaultModels;
  const [localModel, setLocalModel] = useState(modelsList[0]);
  const model = currentModel || localModel;
  const setModel = setCurrentModel || setLocalModel;

  useEffect(() => {
    if (chatInputRef.current) {
      autosize(chatInputRef.current);
    }
  }, []);
  useEffect(() => {
    setDisabled(message.length === 0);
  }, [message]);

  // Update message when initialMessage changes
  useEffect(() => {
    if (initialMessage && initialMessage !== message) {
      setMessage(initialMessage);
      if (chatInputRef.current) {
        chatInputRef.current.value = initialMessage;
        // autosize.update(chatInputRef.current);
      }
    }
  }, [initialMessage]);

  // Handle image reference event from parent
  useEffect(() => {
    const handleReferenceImage = (event: CustomEvent) => {
      const { imageBase64 } = event.detail;
      setAttachedImages((prev) => {
        if (prev.length >= 3) return prev;
        if (prev.includes(imageBase64)) return prev;
        return prev.length < 3 ? [...prev, imageBase64] : prev;
      });
    };

    window.addEventListener(
      "referenceImage",
      handleReferenceImage as EventListener,
    );
    return () => {
      window.removeEventListener(
        "referenceImage",
        handleReferenceImage as EventListener,
      );
    };
  }, []);

  const getPlaceholderText = () =>
    uiStateManager.getPlaceholderText(selectedTool);

  const handleReferenceImage = (imageBase64: string) => {
    imageManager.handleReferenceImage(imageBase64);
    if (selectedTool !== 4 && onToolChange) {
      onToolChange(4);
    }
    if (onReferenceImage) {
      onReferenceImage(imageBase64);
    }
  };

  const handleSendMessage = () => {
    messageHandler.handleSendMessage(selectedTool);
  };

  // Handle image paste
  const handlePaste = imageManager.handlePaste;

  // Clear attached image(s)
  const clearImage = imageManager.clearImage;

  // Handle file selection
  const handleFileSelect = fileManager.handleFileSelect;

  // Clear attached file
  const clearFile = fileManager.clearFile;

  const handleInputChange = (value: string) => {
    setMessage(value);
    uiStateManager.handleInputChange(value);
  };

  return (
    <div className="absolute pointer-events-none size-full flex flex-col gap-4 items-center justify-center left-0 top-0 z-40 text-foreground">
      <motion.div
        initial={{ bottom: "35%", opacity: 0 }}
        animate={{ bottom: init ? "0%" : "30%", opacity: 1 }}
        className="flex flex-col absolute  w-full  p-2 gap-4 justify-center items-center"
      >
        {!init && (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="text-3xl text-zinc-200 font-semibold"
            >
              Welcome Back {name?.split(" ")[0]}
            </motion.div>
            <motion.div
              initial={{ width: "70%", height: "100px" }}
              animate={{
                width: init ? "0%" : "70%",
                height: init ? "100px" : "150px",
              }}
              className=" pointer-events-auto flex gap-2 relative"
            >
              <div className="w-full">
                <div className="bg-zinc-900/50 w-full h-fit border flex flex-col transition-all rounded-lg border-border group focus-within:border-foreground/20 ">
                  <div className="relative">
                    {/* Tool indicator */}
                    <AnimatePresence>
                      {selectedTool > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="absolute left-2 top-2 z-10"
                        >
                          <div className="text-red-500">
                            {selectedTool === 1 && <Globe size={18} />}
                            {selectedTool === 2 && <Brain size={18} />}
                            {selectedTool === 4 && <Image size={18} />}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex">
                      <div className="flex-1 relative">
                        <textarea
                          onChange={(e) => setMessage(e.target.value)}
                          onPaste={handlePaste}
                          ref={chatInputRef}
                          placeholder={getPlaceholderText()}
                          name=""
                          id=""
                          className={`size-full min-h-[60px] placeholder:text-foreground/40 resize-none outline-none text-sm pr-12 ${selectedTool > 0 ? "pl-12 pt-2 pb-2" : "p-2"}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (!disabled) handleSendMessage();
                            }
                          }}
                          value={message}
                        ></textarea>
                      </div>

                      {/* Image attachment indicators (multiple) */}
                      <AnimatePresence>
                        {attachedImages.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute top-2 right-2 flex items-center gap-2"
                          >
                            {attachedImages.map((img, idx) => (
                              <div className="relative group" key={idx}>
                                <img
                                  src={img}
                                  alt={`Attached screenshot ${idx + 1}`}
                                  className="w-8 h-8 object-cover rounded border border-border cursor-pointer"
                                  title={`Screenshot ${idx + 1} - Click to remove`}
                                  onClick={() => clearImage(idx)}
                                />
                                <button
                                  onClick={() => clearImage(idx)}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove image"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Attached Files Display */}
                      <AnimatePresence>
                        {attachedFiles.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 1, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1, y: 10 }}
                            transition={{ duration: 0.3, ease: "circInOut" }}
                            className="absolute bottom-full mb-2 left-0 flex gap-2"
                          >
                            {attachedFiles.map((file, idx) => (
                              <div
                                key={idx}
                                onClick={() => clearFile(idx)}
                                className="relative group h-[60px] w-[120px] border-2 border-border hover:border-red-500/40 group transition-colors cursor-pointer overflow-hidden rounded-sm flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"
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
                                <div className="absolute group-hover:opacity-100 opacity-0 transition-all z-30 blur-xl -bottom-1/2 left-1/2 -translate-x-1/2 rounded-full pointer-events-auto bg-red-500/70 size-[60px] flex items-center justify-center"></div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className=" text-sm shrink-0 w-full flex h-[40px] p-1">
                    <div className="h-full w-fit relative">
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ opacity: 0, scaleY: 0.9 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0, scaleY: 0.9 }}
                            style={{ transformOrigin: "bottom center" }}
                            className="absolute bottom-full mb-2 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[60]"
                          >
                            {modelsList.map((m) => (
                              <button
                                key={m.value}
                                onClick={() => {
                                  setModel(m);
                                  setExpanded(false);
                                }}
                                className={`flex gap-3 text-sm w-full transition-colors duration-100 px-3 py-2.5 font-medium hover:bg-foreground/10 items-center ${
                                  m.value === model.value
                                    ? "bg-foreground/5 text-foreground"
                                    : "text-foreground/70"
                                }`}
                              >
                                <img
                                  src={openaiLogo}
                                  alt="OpenAI"
                                  className="w-5 h-5 dark:invert"
                                />
                                <span>{m.value}</span>
                                {m.value === model.value && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="ml-auto"
                                  >
                                    <CheckIcon className="" weight="bold" />
                                  </motion.div>
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div
                        onClick={() => setExpanded((v) => !v)}
                        className={`w-fit flex gap-2 ${
                          expanded
                            ? "bg-foreground/5 border-t border-t-foreground/10 rounded-t-none "
                            : ""
                        } border border-border h-full transition-all delay-75 rounded-lg px-4 py-2 hover:bg-foreground/5 items-center justify-center`}
                      >
                        <img
                          src={openaiLogo}
                          alt="OpenAI"
                          className="w-5 h-5 dark:invert"
                        />
                        {model.value}
                        <ChevronDown
                          className={`${expanded ? "rotate-180" : ""} transition-all`}
                          size={12}
                        ></ChevronDown>
                      </div>
                    </div>

                    {/* Tools Dropdown */}
                    <div
                      className="h-full relative ml-2"
                      ref={toolsDropdownRef}
                    >
                      <AnimatePresence>
                        {toolsDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, scaleY: 0.9 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0, scaleY: 0.9 }}
                            style={{ transformOrigin: "bottom center" }}
                            className="absolute bottom-full mb-2 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[60]"
                          >
                            <button
                              onClick={() => {
                                onToolChange?.(selectedTool === 1 ? 0 : 1);
                                setToolsDropdownOpen(false);
                              }}
                              className={`flex gap-3 text-sm w-full transition-colors duration-100 px-3 py-2.5 font-medium hover:bg-foreground/10 items-center ${
                                selectedTool === 1
                                  ? "bg-foreground/5 text-foreground"
                                  : "text-foreground/70"
                              }`}
                            >
                              <GlobeSimpleIcon className="text-lg" />
                              Web Search
                              {selectedTool === 1 && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="ml-auto"
                                >
                                  <CheckIcon className="" weight="bold" />
                                </motion.div>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                onToolChange?.(selectedTool === 2 ? 0 : 2);
                                setToolsDropdownOpen(false);
                              }}
                              className={`flex gap-3 text-sm w-full transition-colors duration-100 px-3 py-2.5 font-medium hover:bg-foreground/10 items-center ${
                                selectedTool === 2
                                  ? "bg-foreground/5 text-foreground"
                                  : "text-foreground/70"
                              }`}
                            >
                              <BrainIcon className="text-lg" />
                              Super Memory
                              {selectedTool === 2 && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="ml-auto"
                                >
                                  <CheckIcon className="" weight="bold" />
                                </motion.div>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                onToolChange?.(selectedTool === 4 ? 0 : 4);
                                setToolsDropdownOpen(false);
                              }}
                              className={`flex gap-3 text-sm w-full transition-colors duration-100 px-3 py-2.5 font-medium hover:bg-foreground/10 items-center ${
                                selectedTool === 4
                                  ? "bg-foreground/5 text-foreground"
                                  : "text-foreground/70"
                              }`}
                            >
                              <Image className="text-lg" />
                              Image Generation
                              {selectedTool === 4 && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="ml-auto"
                                >
                                  <CheckIcon className="" weight="bold" />
                                </motion.div>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button
                        onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
                        className="h-full px-4 border border-border rounded-lg hover:bg-foreground/5 transition-colors duration-100 flex items-center gap-2 text-sm font-medium text-foreground/70"
                      >
                        <Wrench size={16} />
                        Tools
                        <ChevronDown
                          className={`${toolsDropdownOpen ? "rotate-180" : ""} transition-all`}
                          size={12}
                        />
                      </button>
                    </div>

                    {/* File Upload Button */}
                    <button
                      onClick={handleFileSelect}
                      className="h-full px-3 ml-2 border border-border rounded-lg hover:bg-foreground/5 transition-colors duration-100 flex items-center gap-2 text-sm font-medium text-foreground/70"
                      title="Attach file"
                    >
                      <Plus size={16} />
                    </button>

                    <motion.div
                      initial={{}}
                      whileTap={{ scale: disabled ? 1 : 0.9 }}
                      className={`h-full ml-auto aspect-square  shrink-0 ${
                        disabled ? "saturate-0 pointer-events-none" : ""
                      } flex items-center justify-center `}
                    >
                      <button
                        disabled={disabled}
                        className={`rounded-lg size-full dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors duration-100 p-0 flex items-center justify-center ${
                          disabled && "dark:bg-zinc-800  !text-foreground/20"
                        }`}
                        onClick={handleSendMessage}
                      >
                        <ArrowElbowDownLeftIcon weight="bold"></ArrowElbowDownLeftIcon>
                      </button>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
        <AnimatePresence mode="popLayout">
          {init && (
            <motion.div
              initial={{ width: "70%", height: "100px" }}
              animate={{ width: "100%", height: "120px" }}
              // exit={{ width: "70%", height: "100px" }}
              className=" pointer-events-auto flex gap-2 relative"
            >
              <div className="bg-zinc-900/50 w-full h-full border flex flex-col transition-all rounded-lg border-border group focus-within:border-foreground/20 ">
                <div className="relative h-full">
                  <textarea
                    onChange={() =>
                      handleInputChange(chatInputRef.current?.value ?? "")
                    }
                    onPaste={handlePaste}
                    ref={chatInputRef}
                    placeholder={
                      attachedImages.length > 0
                        ? "Describe what you want to know about these images..."
                        : "Enter your message"
                    }
                    name=""
                    id=""
                    className="size-full  placeholder:text-foreground/40 resize-none outline-none text-sm p-2 pr-12"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!disabled) messageHandler.handleSend();
                      }
                    }}
                    value={message}
                  ></textarea>

                  {/* Image attachment indicators (multiple) */}
                  <AnimatePresence>
                    {attachedImages.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute top-2 right-2 flex items-center gap-2"
                      >
                        {attachedImages.map((img, idx) => (
                          <div className="relative group" key={idx}>
                            <img
                              src={img}
                              alt={`Attached screenshot ${idx + 1}`}
                              className="w-8 h-8 object-cover rounded border border-border cursor-pointer"
                              title={`Screenshot ${idx + 1} - Click to remove`}
                              onClick={() => clearImage(idx)}
                            />
                            <button
                              onClick={() => clearImage(idx)}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Attached Files Display */}
                  <AnimatePresence>
                    {attachedFiles.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 1, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1, y: 10 }}
                        transition={{ duration: 0.3, ease: "circInOut" }}
                        className="absolute bottom-full mb-2 left-0 flex gap-2"
                      >
                        {attachedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => clearFile(idx)}
                            className="relative group h-[60px] w-[120px] border-2 border-border hover:border-red-500/40 group transition-colors cursor-pointer overflow-hidden rounded-sm flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"
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
                            <div className="absolute group-hover:opacity-100 opacity-0 transition-all z-30 blur-xl -bottom-1/2 left-1/2 -translate-x-1/2 rounded-full pointer-events-auto bg-red-500/70 size-[60px] flex items-center justify-center"></div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className=" text-sm shrink-0 w-full flex h-fit p-1 ">
                  <div className="h-full w-fit relative">
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, scaleY: 0.9 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0.9 }}
                          style={{ transformOrigin: "bottom center" }}
                          className="absolute bottom-full mb-2 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50"
                        >
                          {modelsList.map((m) => (
                            <button
                              key={m.value}
                              onClick={() => {
                                setModel(m);
                                setExpanded(false);
                              }}
                              className={`flex gap-3 text-sm w-full transition-colors duration-100 px-3 py-2.5 font-medium hover:bg-foreground/10 items-center ${
                                m.value === model.value
                                  ? "bg-foreground/5 text-foreground"
                                  : "text-foreground/70"
                              }`}
                            >
                              <img
                                src={openaiLogo}
                                alt="OpenAI"
                                className="w-5 h-5 dark:invert"
                              />
                              <span>{m.value}</span>
                              {m.value === model.value && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="ml-auto"
                                >
                                  <CheckIcon className="" weight="bold" />
                                </motion.div>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div
                      onClick={() => setExpanded((v) => !v)}
                      className={`w-fit flex gap-2 ${
                        expanded
                          ? "bg-foreground/5 border-t border-t-foreground/10 rounded-t-none "
                          : ""
                      } border border-border h-full transition-all delay-75 rounded-lg px-4 py-2 hover:bg-foreground/5 items-center justify-center`}
                    >
                      <img
                        src={openaiLogo}
                        alt="OpenAI"
                        className="w-5 h-5 dark:invert"
                      />
                      {model.value}
                      <ChevronDown
                        className={`${expanded ? "rotate-180" : ""} transition-all`}
                        size={12}
                      ></ChevronDown>
                    </div>
                  </div>

                  {/* Tools Dropdown - Expanded View */}
                  <div className="h-full relative ml-2" ref={toolsDropdownRef2}>
                    <AnimatePresence>
                      {toolsDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, scaleY: 0.9 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0.9 }}
                          style={{ transformOrigin: "bottom center" }}
                          className="absolute bottom-full mb-2 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50"
                        >
                          <button
                            onClick={() => {
                              onToolChange?.(selectedTool === 1 ? 0 : 1);
                              setToolsDropdownOpen(false);
                            }}
                            className={`flex gap-3 text-sm w-full transition-colors duration-100 px-3 py-2.5 font-medium hover:bg-foreground/10 items-center ${
                              selectedTool === 1
                                ? "bg-foreground/5 text-foreground"
                                : "text-foreground/70"
                            }`}
                          >
                            <GlobeSimpleIcon className="text-lg" />
                            Web Search
                            {selectedTool === 1 && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="ml-auto"
                              >
                                <CheckIcon className="" weight="bold" />
                              </motion.div>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onToolChange?.(selectedTool === 2 ? 0 : 2);
                              setToolsDropdownOpen(false);
                            }}
                            className={`flex gap-3 text-sm w-full transition-colors duration-100 px-3 py-2.5 font-medium hover:bg-foreground/10 items-center ${
                              selectedTool === 2
                                ? "bg-foreground/5 text-foreground"
                                : "text-foreground/70"
                            }`}
                          >
                            <BrainIcon className="text-lg" />
                            Super Memory
                            {selectedTool === 2 && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="ml-auto"
                              >
                                <CheckIcon className="" weight="bold" />
                              </motion.div>
                            )}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
                      className="h-full px-4 border border-border rounded-lg hover:bg-foreground/5 transition-colors duration-100 flex items-center gap-2 text-sm font-medium text-foreground/70"
                    >
                      <Wrench size={16} />
                      Tools
                      <ChevronDown
                        className={`${toolsDropdownOpen ? "rotate-180" : ""} transition-all`}
                        size={12}
                      />
                    </button>
                  </div>

                  {/* File Upload Button */}
                  <button
                    onClick={handleFileSelect}
                    className="h-full px-3 ml-2 border border-border rounded-lg hover:bg-foreground/5 transition-colors duration-100 flex items-center gap-2 text-sm font-medium text-foreground/70"
                    title="Attach file"
                  >
                    <Plus size={16} />
                  </button>

                  <motion.div
                    initial={{}}
                    whileTap={{ scale: disabled ? 1 : 0.9 }}
                    className={`h-full ml-auto aspect-square  shrink-0 ${
                      disabled ? "saturate-0 pointer-events-none" : ""
                    } flex items-center justify-center `}
                  >
                    <button
                      disabled={disabled}
                      className={`rounded-lg size-full dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors duration-100 p-0 flex items-center justify-center ${
                        disabled && "dark:bg-zinc-800  !text-foreground/20"
                      }`}
                      onClick={messageHandler.handleSend}
                    >
                      <ArrowElbowDownLeftIcon weight="bold"></ArrowElbowDownLeftIcon>
                    </button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Chat;
