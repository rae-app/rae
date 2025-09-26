{
  /*
  This is the updates api.
  It is used to update the user's name.
*/
}

import axios from "axios";
<<<<<<< HEAD
export const BASE_URL = "https://quackback-xwhd.onrender.com";
// const BASE_URL = "http://localhost:8000";
=======

const BASE_URL = "https://quackback-xwhd.onrender.com";
>>>>>>> 34d3b0e6c2533f0afa461f2c071b0be7363137cf

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
