// Fetch messages when currentConvoId changes (except -1)

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Loader2,
  MessageCircle,
  Globe,
  Brain,
  Image,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import thinkingGif from "../../../assets/thinking.gif";
import ChatSidebarButton from "./components/ChatSidebarButton";
import { useUserStore } from "@/store/userStore";
import { useChatStore } from "@/store/chatStore";
import {
  Generate,
  GenerateWithWebSearch,
  GenerateWithSupermemory,
  GenerateImage,
  getConvoMessage,
  BASE_URL,
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
  // { label: "Gemini", value: "gemini-2.5-flash" },
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
  const [selectedTool, setSelectedTool] = useState<0 | 1 | 2 | 4>(0); // 0=none, 1=web search, 2=supermemory, 4=image generation
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(
    null,
  );
  const [imageReferenced, setImageReferenced] = useState<boolean>(false);
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
  const [streamingMsg, setStreamingMsg] = useState("");
  const [currResponse, setCurrResponse] = useState("");

  const handleStreamAIResponse = async (
    email: string,
    message: string,
    newConvo: boolean,
    conversationId: number,
    provider: string,
    modelName: string,
    image: string,
    tool: number,
    newMessages: any[],
  ) => {
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
            if (currentConvoId === -1) {
              setTitleById(-1, data.title);
              updateConvoId(-1, data.conversationId);
              setCurrentConvo(data.conversationId);
            }
          } else if (data.type === "done") {
            setStreamingMsg("");
            setCurrResponse(fullText);
            let updatedMessages = [
              ...newMessages,
              { sender: "ai", text: fullText, image: "" },
            ];
            setMessages(updatedMessages);
            updateConvoMessages(
              currentConvoId === -1 ? data.conversationId : currentConvoId,
              updatedMessages,
            );
            return {
              success: true,
              data: fullText,
            };
          }
        } catch {
          fullText += dataLine;
          setStreamingMsg((prev) => prev + dataLine);
        }
      });
    }

    setStreamingMsg("");
    setCurrResponse(fullText);
    let updatedMessages = [
      ...newMessages,
      { sender: "ai", text: fullText, image: "" },
    ];
    setMessages(updatedMessages);
    updateConvoMessages(currentConvoId, updatedMessages);
    return {
      success: true,
      data: fullText,
    };
  };

  const handleSend = async (userMsg: string, images?: string[]) => {
    const imagesToSend = images && images.length > 0 ? images : [""];
    let newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg,
        image: imagesToSend,
      },
    ];
    setMessages(newMessages);
    updateConvoMessages(currentConvoId, newMessages);
    setIsAIThinking(true);

    try {
      if ((!images || images.length === 0) && selectedTool === 0) {
        // Streaming logic for normal chat (no image, no tool)
        await handleStreamAIResponse(
          email,
          userMsg,
          currentConvoId === -1,
          currentConvoId,
          currentModel.label,
          currentModel.value,
          "",
          0,
          newMessages,
        );
      } else if (selectedTool === 1) {
        const ai_res = await GenerateWithWebSearch({
          email: email,
          message: userMsg,
          newConvo: currentConvoId == -1 ? true : false,
          conversationId: currentConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imagesToSend,
        });
        let updatedMessages = [
          ...newMessages,
          {
            sender: "ai" as const,
            text: ai_res.aiResponse,
            image: [""],
          },
        ];
        setMessages(updatedMessages);
        updateConvoMessages(currentConvoId, updatedMessages);
        if (currentConvoId === -1) {
          setTitleById(-1, ai_res.title);
          updateConvoId(-1, ai_res.conversationId);
          updateConvoMessages(ai_res.conversationId, updatedMessages);
          setCurrentConvo(ai_res.conversationId);
        }
      } else if (selectedTool === 2) {
        const ai_res = await GenerateWithSupermemory({
          email: email,
          message: userMsg,
          newConvo: currentConvoId == -1 ? true : false,
          conversationId: currentConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imagesToSend,
        });
        let updatedMessages = [
          ...newMessages,
          {
            sender: "ai" as const,
            text: ai_res.aiResponse,
            image: [""],
          },
        ];
        setMessages(updatedMessages);
        updateConvoMessages(currentConvoId, updatedMessages);
        if (currentConvoId === -1) {
          setTitleById(-1, ai_res.title);
          updateConvoId(-1, ai_res.conversationId);
          updateConvoMessages(ai_res.conversationId, updatedMessages);
          setCurrentConvo(ai_res.conversationId);
        }
      } else {
        // Fallback: normal Generate for image
        const ai_res = await Generate({
          email: email,
          message: userMsg,
          newConvo: currentConvoId == -1 ? true : false,
          conversationId: currentConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imagesToSend,
          files: [],
        });
        let updatedMessages = [
          ...newMessages,
          {
            sender: "ai" as const,
            text: ai_res.aiResponse,
            image: [""],
          },
        ];
        setMessages(updatedMessages);
        updateConvoMessages(currentConvoId, updatedMessages);
        if (currentConvoId === -1) {
          setTitleById(-1, ai_res.title);
          updateConvoId(-1, ai_res.conversationId);
          updateConvoMessages(ai_res.conversationId, updatedMessages);
          setCurrentConvo(ai_res.conversationId);
        }
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: "Sorry, I encountered an error. Please try again.",
          image: [""],
        },
      ];
      setMessages(errorMessages);
      updateConvoMessages(currentConvoId, errorMessages);
    } finally {
      setIsAIThinking(false);
      setSelectedTool(0);
      setStreamingMsg("");
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

  // Handler for image generation
  const handleImageGeneration = async (
    userMsg: string,
    images?: string[],
  ) => {
    const imagesToSend = images && images.length > 0 ? images : [""];
    let newMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMsg,
        image: imagesToSend,
      },
    ];
    setMessages(newMessages);
    updateConvoMessages(currentConvoId, newMessages);
    setIsAIThinking(true);

    try {
      const ai_res = await GenerateImage({
        email: email,
        message: userMsg,
        newConvo: currentConvoId == -1 ? true : false,
        conversationId: currentConvoId,
        provider: currentModel.label,
        modelName: currentModel.value,
        image: imagesToSend,
      });
      let updatedMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: ai_res.aiResponse,
          image: ai_res.imageAi || "",
        },
      ];
      setMessages(updatedMessages);
      updateConvoMessages(currentConvoId, updatedMessages);
      if (currentConvoId === -1) {
        setTitleById(-1, ai_res.title);
        updateConvoId(-1, ai_res.conversationId);
        updateConvoMessages(ai_res.conversationId, updatedMessages);
        setCurrentConvo(ai_res.conversationId);
      }
    } catch (error) {
      console.error("Error generating image:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai" as const,
          text: "Sorry, I encountered an error with image generation.",
          image: [""],
        },
      ];
      setMessages(errorMessages);
      updateConvoMessages(currentConvoId, errorMessages);
    } finally {
      setIsAIThinking(false);
      setSelectedTool(0);
    }
  };

  const handleReferenceImage = (imageBase64: string) => {
    // Create a custom event to communicate with ChatInput component
    const event = new CustomEvent("referenceImage", {
      detail: { imageBase64, shouldSwitchTool: selectedTool !== 4 },
    });
    window.dispatchEvent(event);

    // If not already on image generation tool, switch to it for better workflow
    // if (selectedTool !== 4) {
    //   setSelectedTool(4);
    // }

    setImageReferenced(true);
    // Clear the notification after 3 seconds for image generation, 2 for others
    const timeout = selectedTool === 4 ? 3000 : 2000;
    setTimeout(() => setImageReferenced(false), timeout);
  };

  const { name } = useUserStore();
  return (
    <div className="w-full h-dvh  bg-background flex ">
      {/* Chat Area only, sidebar removed */}
      <div className="flex flex-col w-full overflow-hidden relative">
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
                            code: ({ className, children, ...props }: any) => {
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
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                      );
                    }
                  })()}
                </div>
              ) : (
                msg.text
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
            </div>
          ))}

          {/* Streaming AI message (if any) */}
          {streamingMsg && (
            <div className="px-4 py-2 rounded-lg text-sm bg-zinc-200 dark:bg-[#333333] dark:text-white self-start text-left w-fit max-w-[450px]">
              <div className="prose prose-sm max-w-fit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:hidden prose-code:hidden">
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
                className="flex gap-2 mt-2 mx-4 dark:text-zinc-200  font-medium items-center text-sm h-fit"
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
        </motion.div>

        {/* Input area with overlay icons */}
        <Chat
            name={name || ""}
            onSend={handleSend}
            onWebSearch={handleWebSearch}
            onSupermemory={handleSupermemory}
            onImageGeneration={handleImageGeneration}
            currentModel={currentModel}
            setCurrentModel={setCurrentModel}
            models={MODELS}
            initialMessage={initialMessage}
            onTypingChange={handleTypingChange}
            onMessageChange={setCurrentInputMessage}
            selectedTool={selectedTool}
            onToolChange={setSelectedTool}
            onReferenceImage={handleReferenceImage}
        />
      </div>
    </div>
  );
}
