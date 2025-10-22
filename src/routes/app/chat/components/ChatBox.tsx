import React, { useRef, useState, useEffect } from "react";
import {
  Send,
  Globe,
  Brain,
  Image as ImageIcon,
  X,
  Plus,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowElbowDownLeftIcon,
  CheckIcon,
  GlobeSimpleIcon,
  BrainIcon,
  TrashSimpleIcon,
} from "@phosphor-icons/react";
import {
  CustomDropdown,
  Option,
  type DropdownOption,
} from "@/components/app/ui/dropdown";

interface FileAttachment {
  name: string;
  type: string;
  size: number;
  content: string;
  textContent?: string;
}

interface ChatBoxProps {
  onSend?: (
    message: string,
    images?: string[],
    files?: FileAttachment[],
  ) => void;
  onWebSearch?: (
    message: string,
    images?: string[],
    files?: FileAttachment[],
  ) => void;
  onSupermemory?: (
    message: string,
    images?: string[],
    files?: FileAttachment[],
  ) => void;
  onImageGeneration?: (
    message: string,
    images?: string[],
    files?: FileAttachment[],
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  initialMessage?: string | null;
  onTypingChange?: (isTyping: boolean) => void;
  onMessageChange?: (message: string) => void;
  currentModel?: { label: string; value: string };
  setCurrentModel?: (model: { label: string; value: string }) => void;
  models?: { label: string; value: string }[];
}

const defaultModels = [
  { label: "OpenAi", value: "gpt-4o-mini" },
  { label: "OpenAi", value: "gpt-4o" },
];

const ChatBox: React.FC<ChatBoxProps> = ({
  onSend,
  onWebSearch,
  onSupermemory,
  onImageGeneration,
  placeholder = "Type a message...",
  disabled = false,
  initialMessage,
  onTypingChange,
  onMessageChange,
  currentModel,
  setCurrentModel,
  models = defaultModels,
}) => {
  const [message, setMessage] = useState(initialMessage || "");
  const [isDisabled, setIsDisabled] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [selectedTool, setSelectedTool] = useState<0 | 1 | 2 | 4>(0);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize message from prop
  useEffect(() => {
    if (initialMessage && textareaRef.current) {
      setMessage(initialMessage);
      textareaRef.current.value = initialMessage;
    }
  }, [initialMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Handle input changes
  useEffect(() => {
    const isEmpty = message.trim() === "";
    setIsDisabled(isEmpty || disabled);
    const typing = message.length > 0;
    setIsTyping(typing);

    if (onTypingChange) {
      onTypingChange(typing);
    }
    if (onMessageChange) {
      onMessageChange(message);
    }
  }, [message, disabled, onTypingChange, onMessageChange]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        toolsDropdownRef.current &&
        !toolsDropdownRef.current.contains(event.target as Node)
      ) {
        setToolsDropdownOpen(false);
      }
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setModelDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle image reference events
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

  const resetInputs = () => {
    setMessage("");
    setIsTyping(false);
    setAttachedImages([]);
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSendMessage = () => {
    if (isDisabled || !message.trim()) return;

    const imagesToSend =
      attachedImages.length > 0 ? attachedImages.slice(0, 3) : undefined;
    const filesToSend = attachedFiles.length > 0 ? attachedFiles : undefined;

    switch (selectedTool) {
      case 1:
        if (onWebSearch) {
          onWebSearch(message, imagesToSend, filesToSend);
        }
        break;
      case 2:
        if (onSupermemory) {
          onSupermemory(message, imagesToSend, filesToSend);
        }
        break;
      case 4:
        if (onImageGeneration) {
          onImageGeneration(message, imagesToSend, filesToSend);
        }
        break;
      default:
        if (onSend) {
          onSend(message, imagesToSend, filesToSend);
        }
        break;
    }

    resetInputs();
    setSelectedTool(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  const clearImage = (idx: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFileSelect = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "*/*";

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach((file) => {
          if (file.size > 10 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Maximum size is 10MB.`);
            return;
          }

          const isTextFile =
            file.type.startsWith("text/") ||
            /\.(txt|js|ts|py|json|md|html|css|xml)$/i.test(file.name);

          if (isTextFile) {
            const textReader = new FileReader();
            textReader.onload = (textEvent) => {
              const textContent = textEvent.target?.result as string;
              const base64Reader = new FileReader();
              base64Reader.onload = (base64Event) => {
                const base64 = base64Event.target?.result as string;
                setAttachedFiles((prev) => {
                  if (prev.length >= 5) return prev;
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
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              setAttachedFiles((prev) => {
                if (prev.length >= 5) return prev;
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
        return placeholder;
    }
  };

  return (
    <div className="w-full  bg-background relative">
      {/* Attached Files Display */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-4 pb-0"
          >
            <div className="flex gap-2 flex-wrap">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  onClick={() => clearFile(idx)}
                  className="relative group h-[60px] w-[120px] border-2 border-border hover:border-red-500/40 transition-colors cursor-pointer overflow-hidden rounded-sm flex items-center justify-center bg-stone-100 dark:bg-stone-800"
                >
                  <div className="flex flex-col items-center justify-center p-2 text-xs">
                    <div className="font-medium truncate w-full text-center">
                      {file.name}
                    </div>
                    <div className="text-stone-500 text-[10px]">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4">
        <div className="bg-stone-900/50 border border-border rounded-lg group focus-within:border-foreground/20">
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
                  <div className="text-blue-500">
                    {selectedTool === 1 && <Globe size={18} />}
                    {selectedTool === 2 && <Brain size={18} />}
                    {selectedTool === 4 && <ImageIcon size={18} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={getPlaceholderText()}
                  disabled={disabled}
                  className={`w-full min-h-[60px] max-h-[120px] placeholder:text-foreground/40 resize-none outline-none text-sm bg-transparent text-foreground ${
                    selectedTool > 0 ? "pl-12 pt-2 pb-2 pr-12" : "p-2 pr-12"
                  }`}
                  rows={1}
                />
              </div>

              {/* Image attachment indicators */}
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
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="text-sm shrink-0 w-full flex h-[40px] p-1">
            {/* Model Selector */}
            <div className="h-full w-fit relative mr-2" ref={modelDropdownRef}>
              <CustomDropdown
                isOpen={modelDropdownOpen}
                onClose={() => setModelDropdownOpen(false)}
                position="bottom-left"
                variant="rich"
                minWidth="150px"
              >
                {models.map((model) => (
                  <Option
                    key={model.value}
                    label={model.value}
                    value={model.value}
                    active={currentModel?.value === model.value}
                    variant="rich"
                    onClick={() => {
                      if (setCurrentModel) setCurrentModel(model);
                    }}
                  />
                ))}
              </CustomDropdown>
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="h-full px-3 border border-border rounded-lg hover:bg-foreground/5 transition-colors duration-100 flex items-center gap-2 text-sm font-medium text-foreground/70"
              >
                {currentModel?.value || models[0]?.value}
                <ChevronDown
                  className={`${modelDropdownOpen ? "rotate-180" : ""} transition-all`}
                  size={12}
                />
              </button>
            </div>

            {/* Tools Dropdown */}
            <div className="h-full w-fit relative mr-2" ref={toolsDropdownRef}>
              <CustomDropdown
                isOpen={toolsDropdownOpen}
                onClose={() => setToolsDropdownOpen(false)}
                position="bottom-left"
                variant="rich"
                minWidth="200px"
              >
                <Option
                  label="Normal Chat"
                  value="normal"
                  icon={<Send size={16} />}
                  active={selectedTool === 0}
                  variant="rich"
                  onClick={() => setSelectedTool(0)}
                />
                <Option
                  label="Web Search"
                  value="web-search"
                  icon={<Globe size={16} />}
                  active={selectedTool === 1}
                  variant="rich"
                  onClick={() => setSelectedTool(1)}
                />
                <Option
                  label="Super Memory"
                  value="super-memory"
                  icon={<Brain size={16} />}
                  active={selectedTool === 2}
                  variant="rich"
                  onClick={() => setSelectedTool(2)}
                />
                <Option
                  label="Image Generation"
                  value="image-generation"
                  icon={<ImageIcon size={16} />}
                  active={selectedTool === 4}
                  variant="rich"
                  onClick={() => setSelectedTool(4)}
                />
              </CustomDropdown>
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
              className="h-full px-3 mr-2 border border-border rounded-lg hover:bg-foreground/5 transition-colors duration-100 flex items-center gap-2 text-sm font-medium text-foreground/70"
              title="Attach file"
            >
              <Plus size={16} />
            </button>

            {/* Send Button */}
            <motion.div
              whileTap={{ scale: isDisabled ? 1 : 0.9 }}
              className={`h-full ml-auto aspect-square shrink-0 ${
                isDisabled ? "saturate-0 pointer-events-none" : ""
              } flex items-center justify-center`}
            >
              <button
                disabled={isDisabled}
                className={`rounded-lg size-full bg-stone-800 hover:bg-stone-700 transition-colors duration-100 p-0 flex items-center justify-center ${
                  isDisabled && "bg-stone-800 !text-foreground/20"
                }`}
                onClick={handleSendMessage}
              >
                <ArrowElbowDownLeftIcon weight="bold" />
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
