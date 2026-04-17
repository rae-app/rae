/*
  This is the chat api.
  It is used to generate messages and get conversations.
*/

import axios from "axios";
import { useUserStore } from "../store/userStore";

export const BASE_URL = "https://quackback-xwhd.onrender.com/api";
//export const BASE_URL = "http://localhost:8000/api";
// Security fix: include the persisted bearer token when available without changing request behavior when unauthenticated.
const getAuthHeaders = () => {
  const token = useUserStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const Generate = async ({
  email,
  message,
  newConvo,
  conversationId,
  provider,
  modelName,
  image,
  tool = 0,
  files,
}): Promise<any> => {
  try {
    let res;
    let normalizedImage: string[];
    
    if (Array.isArray(image)) {
      // If it's already an array, filter out empty strings
      const validImages = image.filter(img => img && typeof img === 'string' && img.trim() !== '');
      normalizedImage = validImages.length > 0 ? validImages : [''];
    } else if (typeof image === 'string' && image.trim() !== '') {
      // If it's a non-empty string, wrap in array
      normalizedImage = [image];
    } else {
      // If it's undefined, null, empty string, or anything else, use [""]
      normalizedImage = [''];
    }

    // Normal axios request
    res = await axios.post(`${BASE_URL}/generate/msg`, {
      email,
      message,
      newConvo,
      conversationId,
      provider,
      modelName,
      image: normalizedImage,
      tool,
      files,
    }, { headers: getAuthHeaders() });
    return res.data;
  } catch (err: any) {
    const message =
      err.response?.data || "Response Generation Failed. Try again later.";
    return {
      success: false,
      message,
    };
  }
};
// Web search function using tool 1
export const GenerateWithWebSearch = async ({
  email,
  message,
  newConvo,
  conversationId,
  provider,
  modelName,
  image = [""],
}): Promise<any> => {
  return Generate({
    email,
    message,
    newConvo,
    conversationId,
    provider,
    modelName,
    image,
    tool: 1, // web search tool
    files: [],
  });
};

// Supermemory function using tool 2
export const GenerateWithSupermemory = async ({
  email,
  message,
  newConvo,
  conversationId,
  provider,
  modelName,
  image = [""],
}): Promise<any> => {
  return Generate({
    email,
    message,
    newConvo,
    conversationId,
    provider,
    modelName,
    image,
    tool: 2, // supermemory tool
    files: [],
  });
};
export const GenerateImage = async ({
  email,
  message,
  newConvo,
  conversationId,
  provider,
  modelName,
  image = [""],
}): Promise<any> => {
  return Generate({
    email,
    message,
    newConvo,
    conversationId,
    provider,
    modelName,
    image,
    tool: 4, // iamge generation tool
    files: [],
  });
};

export const GetConvos = async ({ email }): Promise<any> => {
  try {
    const res = await axios.post(`${BASE_URL}/conversations/title`, {
      email,
    }, {
      headers: getAuthHeaders(),
    });
    const formatted = res.data.map((c: any) => ({
      id: c.id,
      title: c.title,
      messages: [], // always start blank
    }));
    return {
      success: true,
      data: formatted,
    };
  } catch (err: any) {
    const message =
      err.response?.data || "Convo fetching failed. Try again later.";
    return {
      success: false,
      message,
    };
  }
};

export const getConvoMessage = async ({ convoId }): Promise<any> => {
  try {
    const res = await axios.post(`${BASE_URL}/conversations/messages`, {
      conversationId: convoId,
    }, {
      headers: getAuthHeaders(),
    });
    const formatted = res.data.map((c: any) => ({
      id: c.id,
      title: c.title,
      messages: [], // always start blank
    }));
    return {
      success: true,
      data: res.data,
    };
  } catch (err: any) {
    const message =
      err.response?.data || "Message Fetching Failed. Try again later.";
    return {
      success: false,
      message,
    };
  }
};
