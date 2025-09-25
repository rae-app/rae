{
  /*
  This is the fetch api.
  It is used to fetch the user's name.
*/
}

import axios from "axios";

const BASE_URL = "https://quackback-xwhd.onrender.com/api";

export const fetchUserName = async (email: string | null): Promise<string> => {
  const { data } = await axios.post(
    `${BASE_URL}/update/get-name`,
    {
      email: email,
    },
  );
  console.log("heres the response bro :", data);
  return data.name;
};
