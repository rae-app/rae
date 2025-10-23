import {
  BASE_URL,
  Generate,
  GenerateImage,
  GenerateWithSupermemory,
  GenerateWithWebSearch,
  getConvoMessage,
} from "@/api/chat";
import CodeBlock from "@/components/misc/CodeBlock";
import { useChatStore, type ChatMessage } from "@/store/chatStore";
import { useUserStore } from "@/store/userStore";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import ChatBox from "./components/ChatBox";

const MODELS = [
  { label: "OpenAi", value: "gpt-4o-mini" },
  { label: "OpenAi", value: "gpt-4o" },
];

export default function ChatWindow() {
  const {
    messages,
    setMessages,
    currentConvoId,
    setCurrentConvo,
    setTitleById,
    updateConvoId,
    updateConvoMessages,
    addNewConvo,
    fetchConvoHistory,
  } = useChatStore();
  const { email, name } = useUserStore();
  const [streamingMsg, setStreamingMsg] = useState("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [currentModel, setCurrentModel] = useState(MODELS[0]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new message (smooth for new messages)
  useEffect(() => {
    if (messages.length > 0 && currentConvoId !== -1 && !loadingMessages) {
      scrollToBottom();
    }
  }, [messages, currentConvoId, loadingMessages]);

  // Scroll to bottom during streaming (always smooth)
  useEffect(() => {
    if (streamingMsg && streamingMsg.length > 0) {
      scrollToBottom(50, false);
    }
  }, [streamingMsg]);

  // Scroll to bottom when AI starts thinking
  useEffect(() => {
    if (isAIThinking) {
      scrollToBottom();
    }
  }, [isAIThinking]);

  // Load conversation history when component mounts
  useEffect(() => {
    if (email) {
      fetchConvoHistory(email);
    }
  }, [email, fetchConvoHistory]);

  // Load conversation messages when currentConvoId changes
  useEffect(() => {
    if (currentConvoId !== -1) {
      loadConversation(currentConvoId);
    } else {
      // Initialize new chat when no conversation is selected
      setMessages([]);
      setLoadingMessages(false);
    }
  }, [currentConvoId]);

  const scrollToBottom = (delay = 100, instant = false) => {
    setTimeout(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({
          behavior: instant ? "instant" : "smooth",
          block: "end",
        });
      }
    }, delay);
  };

  const loadConversation = async (convoId: number) => {
    setLoadingMessages(true);
    try {
      const res = await getConvoMessage({ convoId });
      if (res.success && Array.isArray(res.data)) {
        const formattedMessages = res.data.map((m: any) => ({
          sender: m.sender === "user" ? "user" : "ai",
          text: m.content,
          image: m.image || [""],
        }));

        // Scroll to bottom instantly before showing messages
        scrollToBottom(0, true);

        // Set messages after a brief delay to ensure scroll happens first
        setTimeout(() => {
          setMessages(formattedMessages);
          updateConvoMessages(convoId, formattedMessages);
        }, 50);
      } else {
        console.error("Failed to fetch messages:", res.message);
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setTimeout(() => {
        setLoadingMessages(false);
      }, 100);
    }
  };

  const handleNewChat = () => {
    // Reset to new chat state
    setCurrentConvo(-1);
    setMessages([]);
    setStreamingMsg("");
    setIsAIThinking(false);
    setLoadingMessages(false);
  };

  const handleStreamAIResponse = async (
    email: string,
    message: string,
    newConvo: boolean,
    conversationId: number,
    provider: string,
    modelName: string,
    image: string[],
    tool: number,
    newMessages: ChatMessage[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
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
        files: files || [],
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
            let updatedMessages = [
              ...newMessages,
              { sender: "ai", text: fullText, image: [""] } as ChatMessage,
            ];
            setMessages(updatedMessages);
            updateConvoMessages(
              currentConvoId === -1 ? data.conversationId : currentConvoId,
              updatedMessages,
            );

            // Refresh conversation history to show new chat in sidebar
            if (currentConvoId === -1 && email) {
              fetchConvoHistory(email);
            }
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
    let updatedMessages = [
      ...newMessages,
      { sender: "ai", text: fullText, image: [""] } as ChatMessage,
    ];
    setMessages(updatedMessages);
    updateConvoMessages(currentConvoId, updatedMessages);
    return {
      success: true,
      data: fullText,
    };
  };

  const handleSend = async (
    userMsg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => {
    const imagesToSend = images && images.length > 0 ? images : [""];
    const filesToSend = files && files.length > 0 ? files : [];
    let newMessages = [
      ...messages,
      {
        sender: "user",
        text: userMsg,
        image: imagesToSend,
        files: filesToSend,
      } as ChatMessage,
    ];
    setMessages(newMessages);
    updateConvoMessages(currentConvoId, newMessages);
    setIsAIThinking(true);

    try {
      if (!images || images.length === 0) {
        // Streaming logic for normal chat
        await handleStreamAIResponse(
          email,
          userMsg,
          currentConvoId === -1,
          currentConvoId,
          currentModel.label,
          currentModel.value,
          imagesToSend,
          0,
          newMessages,
          filesToSend,
        );
      } else {
        // Fallback: normal Generate for images or files
        const ai_res = await Generate({
          email: email,
          message: userMsg,
          newConvo: currentConvoId == -1 ? true : false,
          conversationId: currentConvoId,
          provider: currentModel.label,
          modelName: currentModel.value,
          image: imagesToSend,
          files: filesToSend,
        });
        let updatedMessages = [
          ...newMessages,
          {
            sender: "ai",
            text: ai_res.aiResponse,
            image: [""],
          } as ChatMessage,
        ];
        setMessages(updatedMessages);
        updateConvoMessages(currentConvoId, updatedMessages);
        if (currentConvoId === -1) {
          setTitleById(-1, ai_res.title);
          updateConvoId(-1, ai_res.conversationId);
          updateConvoMessages(ai_res.conversationId, updatedMessages);
          setCurrentConvo(ai_res.conversationId);

          // Refresh conversation history to show new chat in sidebar
          if (email) {
            fetchConvoHistory(email);
          }
        }
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai",
          text: "Sorry, I encountered an error. Please try again.",
          image: [""],
        } as ChatMessage,
      ];
      setMessages(errorMessages);
      updateConvoMessages(currentConvoId, errorMessages);
    } finally {
      setIsAIThinking(false);
      setStreamingMsg("");
    }
  };

  const handleWebSearch = async (
    userMsg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => {
    const imagesToSend = images && images.length > 0 ? images : [""];
    let newMessages = [
      ...messages,
      {
        sender: "user",
        text: userMsg,
        image: imagesToSend,
        files: files,
      } as ChatMessage,
    ];
    setMessages(newMessages);
    updateConvoMessages(currentConvoId, newMessages);
    setIsAIThinking(true);

    try {
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
          sender: "ai",
          text: ai_res.aiResponse,
          image: [""],
        } as ChatMessage,
      ];
      setMessages(updatedMessages);
      updateConvoMessages(currentConvoId, updatedMessages);
      if (currentConvoId === -1) {
        setTitleById(-1, ai_res.title);
        updateConvoId(-1, ai_res.conversationId);
        updateConvoMessages(ai_res.conversationId, updatedMessages);
        setCurrentConvo(ai_res.conversationId);

        // Refresh conversation history to show new chat in sidebar
        if (email) {
          fetchConvoHistory(email);
        }
      }
    } catch (error) {
      console.error("Error with web search:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai",
          text: "Sorry, I encountered an error with web search.",
          image: [""],
        } as ChatMessage,
      ];
      setMessages(errorMessages);
      updateConvoMessages(currentConvoId, errorMessages);
    } finally {
      setIsAIThinking(false);
    }
  };

  const handleSupermemory = async (
    userMsg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => {
    const imagesToSend = images && images.length > 0 ? images : [""];
    let newMessages = [
      ...messages,
      {
        sender: "user",
        text: userMsg,
        image: imagesToSend,
        files: files,
      } as ChatMessage,
    ];
    setMessages(newMessages);
    updateConvoMessages(currentConvoId, newMessages);
    setIsAIThinking(true);

    try {
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
          sender: "ai",
          text: ai_res.aiResponse,
          image: [""],
        } as ChatMessage,
      ];
      setMessages(updatedMessages);
      updateConvoMessages(currentConvoId, updatedMessages);
      if (currentConvoId === -1) {
        setTitleById(-1, ai_res.title);
        updateConvoId(-1, ai_res.conversationId);
        updateConvoMessages(ai_res.conversationId, updatedMessages);
        setCurrentConvo(ai_res.conversationId);

        // Refresh conversation history to show new chat in sidebar
        if (email) {
          fetchConvoHistory(email);
        }
      }
    } catch (error) {
      console.error("Error with supermemory:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai",
          text: "Sorry, I encountered an error with supermemory.",
          image: [""],
        } as ChatMessage,
      ];
      setMessages(errorMessages);
      updateConvoMessages(currentConvoId, errorMessages);
    } finally {
      setIsAIThinking(false);
    }
  };

  const handleImageGeneration = async (
    userMsg: string,
    images?: string[],
    files?: {
      name: string;
      type: string;
      size: number;
      content: string;
      textContent?: string;
    }[],
  ) => {
    const imagesToSend = images && images.length > 0 ? images : [""];
    let newMessages = [
      ...messages,
      {
        sender: "user",
        text: userMsg,
        image: imagesToSend,
        files: files,
      } as ChatMessage,
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
          sender: "ai",
          text: ai_res.aiResponse,
          image: ai_res.imageAi || [""],
        } as ChatMessage,
      ];
      setMessages(updatedMessages);
      updateConvoMessages(currentConvoId, updatedMessages);
      if (currentConvoId === -1) {
        setTitleById(-1, ai_res.title);
        updateConvoId(-1, ai_res.conversationId);
        updateConvoMessages(ai_res.conversationId, updatedMessages);
        setCurrentConvo(ai_res.conversationId);

        // Refresh conversation history to show new chat in sidebar
        if (email) {
          fetchConvoHistory(email);
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
      const errorMessages = [
        ...newMessages,
        {
          sender: "ai",
          text: "Sorry, I encountered an error with image generation.",
          image: [""],
        } as ChatMessage,
      ];
      setMessages(errorMessages);
      updateConvoMessages(currentConvoId, errorMessages);
    } finally {
      setIsAIThinking(false);
    }
  };

  return (
    <div className="w-full h-dvh bg-background flex">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header with New Chat button */}

        <motion.div
          className="flex-1 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col gap-4 p-4 h-fit relative">
            {loadingMessages && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 h-[500px] backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8  border-2 border-t-0 border-surface"></div>
                  <div className="text-sm text-foreground/60">
                    Loading conversation...
                  </div>
                </div>
              </div>
            )}
            {/* Welcome message for new chats */}
            {currentConvoId === -1 &&
              messages.length === 0 &&
              !loadingMessages &&
              !isAIThinking &&
              !streamingMsg && (
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
                  <div className="text-center max-w-md">
                    <div className="mb-6">
                      <h2 className="text-4xl font-light text-foreground mb-2">
                        Welcome Back, {name?.split(" ")[0] || "User"}
                      </h2>
                    </div>
                  </div>
                </div>
              )}

            {Array.isArray(messages) &&
              !loadingMessages &&
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    msg.sender === "user"
                      ? "bg-stone-800  text-white rounded-2xl rounded-br-md px-4 py-3 self-end text-right ml-auto  "
                      : "bg-transparent text-foreground self-start text-left w-full max-w-[450px]"
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
                                p: ({ children }) => (
                                  <p className="mb-1 ">
                                    {children
                                      .toString()
                                      .split("")
                                      .map((letter, index) => (
                                        <motion.span key={index + letter}>
                                          {letter}
                                        </motion.span>
                                      ))}
                                  </p>
                                ),
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
                              className="relative w-full h-fit   rounded-md overflow-hidden mb-1"
                            >
                              <img
                                src={img}
                                alt={
                                  msg.sender === "user"
                                    ? "User uploaded"
                                    : "AI generated"
                                }
                                className="max-w-full rounded-lg scale-105"
                              />
                            </div>
                          ))}
                      </div>
                    )}

                  {/* Show attached files if exist */}
                  {(msg as any).files && (msg as any).files.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                        Attached files:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(msg as any).files.map(
                          (file: any, fileIdx: number) => (
                            <div
                              key={fileIdx}
                              className="flex items-center gap-2 px-3 py-2 bg-stone-100 dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700"
                            >
                              <div className="flex flex-col">
                                <div className="text-sm font-medium truncate max-w-[150px]">
                                  {file.name}
                                </div>
                                <div className="text-xs text-stone-500">
                                  {(file.size / 1024).toFixed(1)}KB •{" "}
                                  {file.type}
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

            {/* Streaming AI message (if any) */}
            {streamingMsg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-2 rounded-lg text-sm bg-stone-900  dark:text-white self-start text-left w-fit max-w-[450px]"
              >
                <div className="prose prose-sm max-w-fit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:hidden prose-code:hidden">
                  {streamingMsg}
                </div>
              </motion.div>
            )}

            {/* AI Thinking Animation - Simple Pulsing Dot */}
            <AnimatePresence mode="popLayout">
              {isAIThinking && (
                <motion.div
                  className="flex gap-2 mt-2 mx-4 dark:text-stone-200 font-medium items-center text-sm h-fit"
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

        <ChatBox
          onSend={handleSend}
          onWebSearch={handleWebSearch}
          onSupermemory={handleSupermemory}
          onImageGeneration={handleImageGeneration}
          currentModel={currentModel}
          setCurrentModel={setCurrentModel}
          models={MODELS}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
}
