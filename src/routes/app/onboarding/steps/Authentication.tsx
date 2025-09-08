import React, { useState } from "react";
import { Login, SignUp } from "@/api/auth";
import { useUserStore } from "@/store/userStore";
import { loginSchema, signupSchema } from "@/utils/authSchema";
import { Loader } from "lucide-react";
import Button from "@/components/ui/Button";
const Auth: React.FC<{ onNext: (step: string) => void }> = ({ onNext }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useUserStore();

  const validateForm = (): boolean => {
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        signupSchema.parse({ email, password, confirmPassword });
      }
      return true;
    } catch (err: any) {
      if (err?.issues?.length > 0) {
        setError(err.issues[0].message); // Show the first validation error
      } else {
        setError("Validation failed");
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!validateForm()) return;
    setLoading(true);

    try {
      const result = isLogin
        ? await Login(email, password)
        : await SignUp(email, password);

      if (!result.success) {
        setError(result.message);
        return;
      }
      console.log("API result:", result);
      setUser({ email });
      if (isLogin) {
        onNext("fetchInfo");
        return;
      }
      onNext("name");
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drag rounded-md min-h-screen flex items-center justify-center ">
      <div className="w-full max-w-sm  p-8 rounded-xl flex flex-col gap-2">
        <h1 className="text-center mb-2 text-4xl !font-instrument-sans tracking-tighter  ">
          {isLogin ? "Login" : "Create an account"}
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="no-drag w-full px-4 py-3 border-2 dark:border-zinc-600 focus:dark:border-surface/80 rounded-lg  text-sm outline-none"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="no-drag  w-full px-4 py-3 border-2 dark:border-zinc-600 focus:dark:border-surface/80 rounded-lg  text-sm outline-none"
        />

        {!isLogin && (
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="no-drag w-full  px-4 py-3 border rounded-lg  text-sm"
          />
        )}

        {error && <p className="text-red-500 text-sm ">{error}</p>}

        <Button
          onClick={handleSubmit}
          className="w-full dark:bg-surface hover:dark:bg-surface/80"
          // className="no-drag w-full flex justify-center items-center mb-2 py-3 rounded-full bg-black text-white font-medium cursor-pointer hover:scale-105 transition-all duration-300"
        >
          {loading ? <div className="w-full flex items-center justify-center " ><Loader className="animate-spin"  /></div> : "Continue"}
        </Button>

        <Button
        variant="outline"
          onClick={() => {
            setError("");
            setIsLogin(!isLogin);
          }}
          className="w-full  "
          // className="no-drag w-full py-3 rounded-full bg-gray-200 text-black font-medium cursor-pointer hover:scale-105 transition-all duration-300"
        >
          {isLogin ? "Don't have an account?" : "Already have an account?"}
        </Button>
      </div>
    </div>
  );
};

export default Auth;
