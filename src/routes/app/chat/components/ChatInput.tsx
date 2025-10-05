import React, { useEffect, useRef, useState } from "react";
import autosize from "autosize";
import { ChevronDown, Send, Globe, Brain, Image, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { AnimatePresence, motion } from "motion/react";

import { models } from "@/constants/models";

interface ChatInputProps {
  onSend?: (msg: string, image?: string) => void;
  onWebSearch?: (msg: string, image?: string) => void;
  onSupermemory?: (msg: string, image?: string) => void;
  onImageGeneration?: (msg: string, image?: string) => void;
  currentModel?: { label: string; value: string };
  setCurrentModel?: (model: { label: string; value: string }) => void;
  models?: { label: string; value: string }[];
  initialMessage?: string | null;
  onTypingChange?: (isTyping: boolean) => void;
  onMessageChange?: (message: string) => void;
  selectedTool?: 0 | 1 | 2 | 4;
  onToolChange?: (tool: 0 | 1 | 2 | 4) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
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
}) => {
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState(initialMessage || "");
  const [disabled, setDisabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(
    null,
  );

  // Use local model state if not controlled
  const defaultModels = [
    { label: "OpenAi", value: "gpt-4o-mini" },
    { label: "OpenAi", value: "gpt-4o" },
    { label: "Gemini", value: "gemini-2.5-flash" },
  ];
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
        autosize.update(chatInputRef.current);
      }
    }
  }, [initialMessage]);

  const handleSend = () => {
    if (!message.trim()) return;
    if (onSend) onSend(message, attachedImage || undefined);
    setMessage("");
    setIsTyping(false);
    setAttachedImage(null);
    setImagePreview(null);
    if (chatInputRef.current) {
      chatInputRef.current.value = "";
      autosize.update(chatInputRef.current);
    }
  };

  const handleWebSearch = () => {
    if (!message.trim()) return;
    if (onWebSearch) onWebSearch(message, attachedImage || undefined);
    setMessage("");
    setIsTyping(false);
    setAttachedImage(null);
    setImagePreview(null);
    if (chatInputRef.current) {
      chatInputRef.current.value = "";
      autosize.update(chatInputRef.current);
    }
  };

  const handleSupermemory = () => {
    if (!message.trim()) return;
    if (onSupermemory) onSupermemory(message, attachedImage || undefined);
    setMessage("");
    setIsTyping(false);
    setAttachedImage(null);
    setImagePreview(null);
    if (chatInputRef.current) {
      chatInputRef.current.value = "";
      autosize.update(chatInputRef.current);
    }
  };

  const handleImageGeneration = () => {
    if (!message.trim()) return;
    if (onImageGeneration)
      onImageGeneration(message, attachedImage || undefined);
    setMessage("");
    setIsTyping(false);
    setAttachedImage(null);
    setImagePreview(null);
    if (chatInputRef.current) {
      chatInputRef.current.value = "";
      autosize.update(chatInputRef.current);
    }
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

  const handleReferenceImage = (imageBase64: string) => {
    setAttachedImage(imageBase64);
    setImagePreview(imageBase64);

    // If not already on image generation tool, switch to it for better workflow
    if (selectedTool !== 4 && onToolChange) {
      onToolChange(4);
    }
  };

  const getPlaceholderText = () => {
    if (attachedImage) {
      return "Describe what you want to know about this image...";
    }

    switch (selectedTool) {
      case 1:
        return "Web search me...";
      case 2:
        return "Super memory search...";
      case 4:
        return "Generate or modify image...";
      default:
        return "Enter your message or paste a screensho";
    }
  };

  const handleInputChange = (value: string) => {
    setMessage(value);
    const typing = value.length > 0;
    setIsTyping(typing);
    if (onTypingChange) {
      onTypingChange(typing);
    }
    if (onMessageChange) {
      onMessageChange(value);
    }
  };

  const handleSendMessage = () => {
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

  return (
    <div className=" bottom-0  h-fit  text-foreground w-full flex items-center justify-center z-50 p-2">
      <div className="bg-card/50 w-full h-fit border flex flex-col transition-all rounded-lg border-border group focus-within:border-foreground/20 ">
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
          <textarea
            onChange={() =>
              handleInputChange(chatInputRef.current?.value ?? "")
            }
            onPaste={handlePaste}
            ref={chatInputRef}
            placeholder={getPlaceholderText()}
            name=""
            id=""
            className={`size-full min-h-[60px] placeholder:text-foreground/40 resize-none outline-none text-sm pr-12 ${selectedTool > 0 ? "pl-12" : "p-2"}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!disabled) handleSendMessage();
              }
            }}
          ></textarea>

          {/* Image attachment indicator */}
          <AnimatePresence>
            {imagePreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-2 right-2 flex items-center gap-2"
              >
                <div className="relative group">
                  <img
                    src={imagePreview}
                    alt="Attached screenshot"
                    className="w-8 h-8 object-cover rounded border border-border cursor-pointer"
                    title="Screenshot attached - Click to remove"
                    onClick={clearImage}
                  />
                  <button
                    onClick={clearImage}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className=" text-sm shrink-0 w-full flex h-[40px] p-1">
          <div className="h-full w-fit relative">
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: "0px" }}
                  animate={{ height: modelsList.length * 40 + "px" }}
                  exit={{ height: "0px" }}
                  className="absolute bottom-full rounded-t-lg overflow-hidden   backdrop-blur-3xl bg-foreground/5 h-fit w-full flex flex-col"
                >
                  {modelsList.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => {
                        setModel(m);
                        setExpanded(false);
                      }}
                      className="h-[40px] hover:bg-foreground/10 shrink-0 px-4 flex items-center justify-start"
                    >
                      {m.value}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div
              onClick={() => setExpanded(true)}
              className={`w-fit flex gap-2 ${
                expanded
                  ? "bg-foreground/5 border-t border-t-foreground/10 rounded-t-none "
                  : ""
              } border border-border h-full transition-all delay-75 rounded-lg px-4 py-2 hover:bg-foreground/5 items-center justify-center`}
            >
              {model.value}
              <ChevronDown
                className={`${expanded ? "rotate-180" : ""} transition-all`}
                size={12}
              ></ChevronDown>
            </div>
          </div>

          <motion.div
            initial={{}}
            whileTap={{ scale: disabled ? 1 : 0.9 }}
            className={`h-full ml-auto aspect-square  shrink-0 ${
              disabled ? "saturate-0 pointer-events-none" : ""
            } flex items-center justify-center `}
          >
            <Button
              disabled={disabled}
              className={`rounded-lg  size-full  p-0 flex items-center justify-center ${
                disabled && "!bg-foreground/5 !text-foreground/20"
              }`}
              onClick={handleSendMessage}
            >
              <Send size={14}></Send>
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
