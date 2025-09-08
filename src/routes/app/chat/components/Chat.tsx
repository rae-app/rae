
import React, { useEffect, useRef, useState } from "react";
import autosize from "autosize";
import { ChevronDown, Send, Globe, Brain, Image, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { AnimatePresence, motion } from "motion/react";
import { ArrowElbowDownLeftIcon } from "@phosphor-icons/react";

const defaultModels = [
  { label: "OpenAi", value: "gpt-4o-mini" },
  { label: "OpenAi", value: "gpt-4o" },
  { label: "Gemini", value: "gemini-2.5-flash" },
];

interface ChatProps {
  name: string;
  onSend?: (msg: string, image?: string) => void;
  onWebSearch?: (msg: string, image?: string) => void;
  onSupermemory?: (msg: string, image?: string) => void;
  currentModel?: { label: string; value: string };
  setCurrentModel?: (model: { label: string; value: string }) => void;
  models?: { label: string; value: string }[];
  initialMessage?: string | null;
  onTypingChange?: (isTyping: boolean) => void;
  onMessageChange?: (message: string) => void;
  selectedTool?: 0 | 1 | 2;
  onToolChange?: (tool: 0 | 1 | 2) => void;
  initial?: boolean;
}

const Chat: React.FC<ChatProps> = ({
  name,
  onSend,
  onWebSearch,
  onSupermemory,
  currentModel,
  setCurrentModel,
  models: modelsProp,
  initialMessage,
  onTypingChange,
  onMessageChange,
  selectedTool = 0,
  onToolChange,
  initial = false,
}) => {
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState(initialMessage || "");
  const [disabled, setDisabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [init, setInit] = useState(initial);
  // If initial prop changes, update init accordingly
  useEffect(() => {
    setInit(initial);
  }, [initial]);

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
        autosize.update(chatInputRef.current);
      }
    }
  }, [initialMessage]);

  const handleSend = () => {
    if (!message.trim()) return;
    if (!init) setInit(true);
    if (onSend) onSend(message, attachedImage || undefined);
    setMessage("");
    setIsTyping(false);
    setAttachedImage(null);
    setImagePreview(null);
    if (chatInputRef.current) {
      chatInputRef.current.value = "";
    //   autosize.update(chatInputRef.current);
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

  return (
    <div className="absolute pointer-events-none size-full flex flex-col gap-4 items-center justify-center left-0 top-0 z-40 text-foreground">
      <motion.div
        initial={{ bottom: "35%", opacity: 0 }}
        animate={{ bottom: init ? "0%" : "30%", opacity: 1 }}
        className="flex flex-col absolute  w-full  p-2 gap-4 justify-center items-center"
      >
        {!init && (
          <>
            <motion.div animate={{ opacity: 1 }} className="text-3xl text-zinc-200 font-semibold">
              Welcome Back, {name.split(" ")[0]}
            </motion.div>
            <motion.div
              initial={{ width: "70%", height: "100px" }}
              animate={{ width: init ? "0%" : "70%", height: init ? "100px" : "150px" }}
              className=" pointer-events-auto flex gap-2 relative"
            >
              <div className="w-full">
                <div className="bg-zinc-900/50 w-full h-fit border flex flex-col transition-all rounded-lg border-border group focus-within:border-foreground/20 ">
                  <div className="relative">
                    <textarea
                      onChange={() => handleInputChange(chatInputRef.current?.value ?? "")}
                      onPaste={handlePaste}
                      ref={chatInputRef}
                      placeholder={attachedImage ? "Describe what you want to know about this image..." : "Enter your message or paste a screenshot"}
                      name=""
                      id=""
                      className="size-full min-h-[60px] placeholder:text-foreground/40 resize-none outline-none text-sm p-2 pr-12"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!disabled) handleSend();
                        }
                      }}
                      value={message}
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
                                className="h-[40px] hover:bg-foreground/10 shrink-0 px-4 flex  whitespace-nowrap items-center justify-start"
                              >
                                {m.value}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div
                        onClick={() => setExpanded(v => !v)}
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
                      <button
                        disabled={disabled}
                        className={`rounded-lg size-full dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors duration-100 p-0 flex items-center justify-center ${
                          disabled && "dark:bg-zinc-800  !text-foreground/20"
                        }`}
                        onClick={handleSend}
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
                    onChange={() => handleInputChange(chatInputRef.current?.value ?? "")}
                    onPaste={handlePaste}
                    ref={chatInputRef}
                    placeholder={attachedImage ? "Describe what you want to know about this image..." : "Enter your message or paste a screenshot"}
                    name=""
                    id=""
                    className="size-full  placeholder:text-foreground/40 resize-none outline-none text-sm p-2 pr-12"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!disabled) handleSend();
                      }
                    }}
                    value={message}
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
                <div className=" text-sm shrink-0 w-full flex h-fit p-1 overflow-hidden">
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
                              className="h-[40px] hover:bg-foreground/10 shrink-0 px-4 flex  whitespace-nowrap items-center justify-start"
                            >
                              {m.value}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div
                      onClick={() => setExpanded(v => !v)}
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
                   <button
                        disabled={disabled}
                        className={`rounded-lg size-full dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors duration-100 p-0 flex items-center justify-center ${
                          disabled && "dark:bg-zinc-800  !text-foreground/20"
                        }`}
                        onClick={handleSend}
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
