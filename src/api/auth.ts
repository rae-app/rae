{
  /*
  This is the auth api.
  It is used to sign up and login.
  It is also used to get the user's data.
*/
}

import axios from "axios";

const BASE_URL = "http://localhost:8000/api";
export const SignUp = async (
  email: string,
  password: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await axios.post(`${BASE_URL}/auth/signup`, { email, password });

    return {
      success: res.status === 201,
      message: res.data.message || "Signup successful.",
    };
  } catch (err: any) {
    const message =
      err.response?.data?.message ||
      err.message ||
      "Signup failed. Try again later.";
    return {
      success: false,
      message,
    };
  }
};

export const Login = async (
  email: string,
  password: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });

    return {
      success: res.status === 200,
      message: res.data.message || "Login successful.",
    };
  } catch (err: any) {
    const raw = err.response?.data?.message || err.message || "";
    let message = raw || "Login failed. Try again later.";

    // Normalize backend errors to a user-friendly message for missing users
    const status = err.response?.status;
    const lower = String(raw).toLowerCase();
    if (
      status === 404 ||
      status === 500 ||
      lower.includes("no rows returned") ||
      lower.includes("multiple or no rows returned") ||
      lower.includes("json error")
    ) {
      message = "No account found for this email. Please sign up.";
    }

    return {
      success: false,
      message,
    };
  }
};
