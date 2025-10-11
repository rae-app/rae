import type { Dispatch, SetStateAction } from "react";

export const appendUserMessage = (
  setMessages: Dispatch<SetStateAction<any[]>>,
  messages: any[],
  userMsg: string,
  images: any[],
  files: any[],
) => {
  const newMessages = [
    ...messages,
    { sender: "user", text: userMsg, image: images, files },
  ];
  setMessages(newMessages);
  return newMessages;
};

export const appendAIMessage = (
  setMessages: Dispatch<SetStateAction<any[]>>,
  messages: any[],
  text: string,
  images: any[] = [""],
) => {
  const updated = [...messages, { sender: "ai", text, image: images }];
  setMessages(updated);
  return updated;
};

export const setErrorAIMessage = (
  setMessages: Dispatch<SetStateAction<any[]>>,
  messages: any[],
  errText = "Sorry, I encountered an error.",
) => {
  const errorMessages = [...messages, { sender: "ai", text: errText, image: [""] }];
  setMessages(errorMessages);
  return errorMessages;
};
