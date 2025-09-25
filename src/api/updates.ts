{/*
  This is the updates api.
  It is used to update the user's name.
*/}

import axios from "axios";

const BASE_URL = "https://quackback-xwhd.onrender.com";

export const NameUpdate = async (
  name: string,
  email: string | null,
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await axios.post(`${BASE_URL}/api/update/name`, {
      email: email,
      name: name,
    });
    console.log(res);
    return {
      success: res.status === 201,
      message: res.data.message || "Name Update Successfull",
    };
  } catch (err: any) {
    return {
      success: false,
      message: "Name Update Failed",
    };
  }
};
