import { create } from "zustand";

import { GetConvos } from "@/api/chat";
export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  image: string[];
  files?: {
    name: string;
    type: string;
    size: number;
    content: string;
    textContent?: string;
  }[];
}

export interface Conversation {
  id: number;
  title: string;
  messages: ChatMessage[];
  summary: string;
}

interface ChatState {
  messages: ChatMessage[]; // messages for the current convo
  currentConvoId: number;
  convoHistory: Conversation[];
  chatSummary: string;
  setChatSummary: (summary: string) => void;
  // OVerlay chat State
  overlayChatTitle: string;
  setOverlayChatTitle: (newTitle: string) => void;
  convoTitleLoading: boolean;
  setConvoTitleLoading: (loading: boolean) => void;
  overlayConvoId: number;
  setOverlayConvoId: (id: number) => void;
  // Current convo message controls
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  // Conversation management
  addNewConvo: () => void;
  setCurrentConvo: (id: number) => void;
  setTitleById: (id: number, newTitle: string) => void;
  updateConvoId: (tempId: number, newId: number) => void;
  updateConvoMessages: (id: number, messages: ChatMessage[]) => void;
  updateConvoSummary: (id: number, summary: string) => void;

  fetchConvoHistory: (email: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentConvoId: -1,
  convoHistory: [
    {
      id: -1,
      title: "New Chat",
      messages: [],
      summary: "",
    },
  ],
  chatSummary: "",
  setChatSummary: (summary) => set({ chatSummary: summary }),
  convoTitleLoading: false,
  setConvoTitleLoading: (loading) => set({ convoTitleLoading: loading }),
  overlayChatTitle: "New Chat",
  setOverlayChatTitle: (newTitle) => set({ overlayChatTitle: newTitle }),
  overlayConvoId: -1,
  setOverlayConvoId: (id) => set({ overlayConvoId: id }),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  fetchConvoHistory: async (email: string) => {
    try {
      if (!email) {
        console.error("No email found in user store");
        return;
      }
      set({ convoTitleLoading: true });
      const res = await GetConvos({ email });
      if (res.success === false) {
        console.error("Failed to load convos", res.message);
        return;
      }

      const withPlaceholder = [
        {
          id: -1,
          title: "New Chat",
          messages: [],
          summary: "",
        },
        ...res.data,
      ];

      set({ convoHistory: withPlaceholder, convoTitleLoading: false });
    } catch (err) {
      console.error("Error fetching convo history:", err);
    }
  },
  addNewConvo: () => {
    const { currentConvoId, messages, convoHistory } = get();

    // If the active convo is still the placeholder and empty, don't add a new one
    if (currentConvoId === -1 && messages.length === 0) {
      return;
    }

    // Check if a conversation with id -1 already exists
    const existingPlaceholder = convoHistory.find((convo) => convo.id === -1);
    if (existingPlaceholder) {
      return; // Don't add a duplicate placeholder
    }

    const newConvo: Conversation = {
      id: -1,
      title: "New Chat",
      messages: [],
      summary: "",
    };

    set((state) => ({
      convoHistory: [...state.convoHistory, newConvo],
      currentConvoId: newConvo.id,
      messages: [],
    }));
  },

  setCurrentConvo: (id) => {
    const convo = get().convoHistory.find((c) => c.id === id);
    set({
      currentConvoId: id,
      messages: convo ? convo.messages : [],
    });
  },

  setTitleById: (id, newTitle) =>
    set((state) => ({
      convoHistory: state.convoHistory.map((c) =>
        c.id === id ? { ...c, title: newTitle } : c,
      ),
    })),

  updateConvoId: (tempId, newId) =>
    set((state) => ({
      convoHistory: state.convoHistory.map((c) =>
        c.id === tempId && tempId === -1 ? { ...c, id: newId } : c,
      ),
      currentConvoId:
        state.currentConvoId === tempId && tempId === -1
          ? newId
          : state.currentConvoId,
    })),

  updateConvoMessages: (id, messages) =>
    set((state) => ({
      convoHistory: state.convoHistory.map((c) =>
        c.id === id ? { ...c, messages } : c,
      ),
      ...(state.currentConvoId === id ? { messages } : {}),
    })),

  updateConvoSummary: (id, summary) =>
    set((state) => ({
      convoHistory: state.convoHistory.map((c) =>
        c.id === id ? { ...c, summary } : c,
      ),
      ...(state.currentConvoId === id ? { chatSummary: summary } : {}),
      ...(state.overlayConvoId === id ? { chatSummary: summary } : {}),
    })),
}));
