{
  /*
  This is the fetch api.
  It is used to fetch the user's name.
*/
}

import axios from "axios";
<<<<<<< HEAD
export const BASE_URL = "https://quackback-xwhd.onrender.com/api";
// const BASE_URL = "http://localhost:8000/api";
=======

const BASE_URL = "https://quackback-xwhd.onrender.com/api";
>>>>>>> 34d3b0e6c2533f0afa461f2c071b0be7363137cf

export const fetchUserName = async (email: string | null): Promise<string> => {
  const { data } = await axios.post(`${BASE_URL}/update/get-name`, {
    email: email,
  });
  console.log("heres the response bro :", data);
  return data.name;
};
