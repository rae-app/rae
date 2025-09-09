// Fetch messages when currentConvoId changes (except -1)

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, MessageCircle, Globe, Brain } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import thinkingGif from "../../../assets/thinking.gif";
import ChatSidebarButton from "./components/ChatSidebarButton";
import { useUserStore } from "@/store/userStore";
import { useChatStore } from "@/store/chatStore";
import {
  Generate,
  GenerateWithWebSearch,
  GenerateWithSupermemory,
  getConvoMessage,
} from "@/api/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import CodeBlock from "@/components/misc/CodeBlock";
import ChatInput from "./components/ChatInput";
import { useNoteStore } from "@/store/noteStore";
import { GetNotes } from "@/api/notes";
import Chat from "./components/Chat";
const MODELS = [
  { label: "OpenAi", value: "gpt-4o-mini" },
  { label: "OpenAi", value: "gpt-4o" },
  { label: "Gemini", value: "gemini-2.5-flash" },
];

export default function ChatWindow() {
  const {
    messages,
    setMessages,
    convoHistory,
    addNewConvo,
    setCurrentConvo,
    currentConvoId,
    setTitleById,
    updateConvoId,
    updateConvoMessages,
    fetchConvoHistory,
    convoTitleLoading,
  } = useChatStore();
  const { email } = useUserStore();
  const [currentModel, setCurrentModel] = useState(MODELS[0]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentInputMessage, setCurrentInputMessage] = useState("");
  const [selectedTool, setSelectedTool] = useState<0 | 1 | 2>(0); // 0=none, 1=web search, 2=supermemory
  const [searchParams] = useSearchParams();
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Get initial message from URL params
  const initialMessage = searchParams.get("message");

  const { setNotes, notes } = useNoteStore();
  const fetchNotes = async () => {
    try {
      const res = await GetNotes({ email });
      setNotes(res);
    } catch (err: any) {
      console.error("notes fetching me err agaya bhaijan", err);
    }
  };
  useEffect(() => {
    fetchNotes();
  }, []);
  useEffect(() => {
    if (email) {
      fetchConvoHistory(email);
      setCurrentConvo(-1);
      // Fetch messages when currentConvoId changes (and is not -1)
    }
  }, [email, fetchConvoHistory]);
  useEffect(() => {
    if (currentConvoId !== -1) {
      convoChange(currentConvoId);
    } else {
      setMessages([]);
    }
  }, [currentConvoId]);
  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Chat input logic is now handled by ChatInput component

  // Handler for ChatInput
  const handleSend = async (userMsg: string, manualImage?: string) => {
    // This is the same as the old handleAIResponse logic
    let newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg, // Normal message without prefix
        image: "",
      },
    ];
    setMessages(newMessages);
    updateConvoMessages(currentConvoId, newMessages);

    // Set AI thinking state to true
    setIsAIThinking(true);

    try {
      // Use manual image if provided, otherwise capture window screenshot
      let imageToSend = manualImage || "";
      if (!manualImage) {
        try {
          imageToSend = (await invoke("capture_window_screenshot")) as string;
          console.log(
            "Screenshot captured for normal chat, length:",
            imageToSend.length
          );
          console.log(
            "Normal chat screenshot starts with:",
            imageToSend.substring(0, 50)
          );
        } catch (screenshotError) {
          console.error(
            "Failed to capture screenshot for normal chat:",
            screenshotError
          );
          // Continue without screenshot if capture fails
        }
      } else {
        console.log("Using manually pasted image, length:", manualImage.length);
        console.log("Manual image starts with:", manualImage.substring(0, 50));
      }

      // Use selected tool if any
      let ai_res;
      if (selectedTool === 1) {
        ai_res = await GenerateWithWebSearch({
          email: email,
          message: userMsg,
          newConvo: currentConvoId == -1 ? true : false,
          conversationId: currentConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imageToSend,
        });
      } else if (selectedTool === 2) {
        ai_res = await GenerateWithSupermemory({
          email: email,
          message: userMsg,
          newConvo: currentConvoId == -1 ? true : false,
          conversationId: currentConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imageToSend,
        });
      } else {
        ai_res = await Generate({
          email: email,
          message: userMsg,
          newConvo: currentConvoId == -1 ? true : false,
          conversationId: currentConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imageToSend,
        });
      }

      let updatedMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: ai_res.aiResponse,
          image: "",
        },
      ];
      setMessages(updatedMessages);

      if (currentConvoId === -1) {
        setTitleById(-1, ai_res.title);
        updateConvoId(-1, ai_res.conversationId);
        updateConvoMessages(ai_res.conversationId, updatedMessages);
        setCurrentConvo(ai_res.conversationId);
      } else {
        updateConvoMessages(currentConvoId, updatedMessages);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: "Sorry, I encountered an error. Please try again.",
          image: "",
        },
      ];
      setMessages(errorMessages);
      updateConvoMessages(currentConvoId, errorMessages);
    } finally {
      // Always clear the thinking state
      setIsAIThinking(false);
      // Reset tool selection after sending
      setSelectedTool(0);
    }
  };

  const convoChange = async (convoId: number) => {
    setCurrentConvo(convoId);
    setIsAIThinking(false);
    const existingMessages =
      messages.length > 0 && currentConvoId === convoId ? messages : [];

    if (existingMessages.length > 0) {
      // Already loaded → just set messages
      setMessages(existingMessages);
      return;
    }
    setLoadingMessages(true);

    try {
      const res = await getConvoMessage({ convoId });
      console.log("Fetched Raw Convos:", res.data);
      if (res.success && Array.isArray(res.data)) {
        const formattedMessages = res.data.map((m: any) => ({
          sender: m.sender == "user" ? "user" : "ai",
          text: m.content,
          image: m.image,
        }));
        console.log("New convo msges:", formattedMessages);
        setMessages(formattedMessages);
        updateConvoMessages(convoId, formattedMessages);
      } else {
        console.error("Failed to fetch messages:", res.message);
      }
    } finally {
      setLoadingMessages(false); // stop loader
    }
  };

  const handleNewChat = () => {
    addNewConvo();
    setCurrentConvo(-1);
    setMessages([]);
    setIsAIThinking(false);
    setSelectedTool(0); // Reset selected tool
  };

  // Handler for typing state changes from ChatInput
  const handleTypingChange = (typing: boolean) => {
    setIsTyping(typing);
  };

  // Handler for web search (called from handleSend when tool is selected)
  const handleWebSearch = async (userMsg: string) => {
    // This function is now only called from handleSend with the selected tool
    // The actual logic is in handleSend function above
    return;
  };

  // Handler for supermemory (called from handleSend when tool is selected)
  const handleSupermemory = async (userMsg: string) => {
    // This function is now only called from handleSend with the selected tool
    // The actual logic is in handleSend function above
    return;
  };

  const { name } = useUserStore();
  return (
    <div className="w-full h-[calc(100vh-36px)]  bg-background flex ">
      {/* Chat Area only, sidebar removed */}
      <div className="flex flex-col w-full overflow-hidden relative">
        <motion.div
          ref={chatContainerRef}
          className="flex flex-col overflow-hidden border-border relative h-[calc(100vh-170px)]"
        >
          <div className="flex-1 flex flex-col overflow-y-auto p-2 space-y-1 scrollbar-hide">
            {loadingMessages && (
              <div className="absolute inset-0 flex items-center justify-center  z-10">
                <Loader2 className="animate-spin text-zinc-700" size={24} />
              </div>
            )}

            {/* {messages.length === 0 && !loadingMessages && (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <p className="text-lg mb-2">Start a conversation</p>
                  <p className="text-sm">
                    Type a message below to begin chatting with AI
                  </p>
                </div>
              </div>
            )} */}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`px-4 py-2 rounded-lg text-sm ${
                  msg.sender === "user"
                    ? "bg-foreground dark:bg-surface font-medium text-background self-end text-right ml-auto w-fit max-w-[70%]"
                    : "bg-zinc-200 dark:bg-[#333333] dark:text-white  self-start text-left w-fit max-w-[450px]"
                }`}
              >
                {msg.sender === "ai" ? (
                  <div className="prose prose-sm max-w-fit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:hidden prose-code:hidden">
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
                                    className={`${className} `}
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
                        // Fallback: Simple line break preservation
                        return (
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {msg.text}
                          </div>
                        );
                      }
                    })()}
                  </div>
                ) : (
                  msg.text
                )}

                {/* ⬇️ Show image if exists */}
                {msg.image && (
                  <div className="mt-2">
                    <img
                      src={msg.image}
                      alt="User uploaded"
                      className="max-w-full rounded-lg border border-gray-300"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* AI Thinking Animation - Simple Pulsing Dot */}
            <AnimatePresence mode="popLayout">
              {isAIThinking && (
                <motion.div
                  className="flex gap-2 mt-2 mx-4 dark:text-zinc-200  font-medium items-center text-sm h-fit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    initial={{ borderRadius: "0%", rotate: "90deg" }}
                    animate={{ borderRadius: ["0%","50%", "0%"], rotate: ["90deg", "180deg", "270deg"] }}
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
        </motion.div>
        <Chat
          name={name}
          onSend={handleSend}
          onWebSearch={handleWebSearch}
          onSupermemory={handleSupermemory}
          currentModel={currentModel}
          setCurrentModel={setCurrentModel}
          models={MODELS}
          initialMessage={initialMessage}
          onTypingChange={handleTypingChange}
          onMessageChange={setCurrentInputMessage}
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          initial={currentConvoId !== -1}
        />
      </div>
    </div>
  );
}
