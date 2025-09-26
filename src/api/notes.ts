import axios from "axios";

const BASE_URL = "https://quackback-xwhd.onrender.com/api";

export const GetNotes = async ({ email }): Promise<string[]> => {
  try {
    const res = await axios.post(`${BASE_URL}/notes/all`, {
      email,
    });
    console.log(res.data);
    return res.data.result.user_context;
  } catch (err: any) {
    return ["Error Showing Data"];
  }
};

export const updateUserNotes = async ({
  email,
  newNotes,
}): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await axios.post(`${BASE_URL}/notes/update`, {
      email,
      notes: newNotes,
    });
    return {
      success: true,
      message: "Success updating message",
    };
  } catch (err: any) {
    return {
      success: false,
      message: "Error updating Notes",
    };
  }
};
