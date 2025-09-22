/*
  This is the chat api.
  It is used to generate messages and get conversations.
*/

import axios from "axios";

// export const BASE_URL = "https://quackback-xwhd.onrender.com/api";
export const BASE_URL = "http://localhost:8000/api";
export const Generate = async ({
  email,
  message,
  newConvo,
  conversationId,
  provider,
  modelName,
  image,
  tool = 0,
}): Promise<any> => {
  try {
    let res;

    if (image || tool) {
      // Normal axios request
      res = await axios.post(`${BASE_URL}/generate/msg`, {
        email,
        message,
        newConvo,
        conversationId,
        provider,
        modelName,
        image,
        tool,
      });
      return res.data;
    } else {
    }
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
  image = "",
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
  image = "",
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
  });
};
export const GenerateImage = async ({
  email,
  message,
  newConvo,
  conversationId,
  provider,
  modelName,
  image = "",
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
  });
};

export const GetConvos = async ({ email }): Promise<any> => {
  try {
    const res = await axios.post(`${BASE_URL}/conversations/title`, {
      email,
    });
    const formatted = res.data.map((c: any) => ({
      id: c.id,
      title: c.title,
      messages: [], // always start blank
    }));
    console.log(formatted);
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
    });
    const formatted = res.data.map((c: any) => ({
      id: c.id,
      title: c.title,
      messages: [], // always start blank
    }));
    console.log(formatted);
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
