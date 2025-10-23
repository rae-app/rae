import { useUserStore } from "@/store/userStore";
import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import onboardingImage from "@/assets/images/onboarding.png";
import logo from "@/assets/images/logo/logo.png";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Login, SignUp } from "@/api/auth";
import { NameUpdate } from "@/api/updates";
import { loginSchema, signupSchema } from "@/utils/authSchema";
import { Loader } from "lucide-react";

interface WelcomeProps {
  onNext: (step: string) => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onNext }) => {
  const {
    loggedIn,
    showSplash,
    setShowSplash,
    email: storedEmail,
    setUser,
    setLoggedIn,
  } = useUserStore();
  const navigate = useNavigate();

  // Form states
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (loggedIn) {
      navigate("/app/chat");
    }
  }, [loggedIn]);

  useEffect(() => {
    // Close any stray magic dot once on load; avoid repeated closing to allow user toggles
    invoke("close_magic_dot").catch(console.error);
  }, []);

  const validateForm = (): boolean => {
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        signupSchema.parse({ email, password, confirmPassword });
        if (!name.trim()) {
          setError("Name is required");
          return false;
        }
      }
      return true;
    } catch (err: any) {
      if (err?.issues?.length > 0) {
        setError(err.issues[0].message);
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
      // Handle authentication (login or signup)
      const result = isLogin
        ? await Login(email, password)
        : await SignUp(email, password);

      if (!result.success) {
        setError(result.message);
        return;
      }

      console.log("Auth result:", result);
      setUser({ email });

      if (isLogin) {
        onNext("fetchInfo");
        return;
      }

      // For signup, also handle name update
      try {
        const nameResult = await NameUpdate(name, email);
        if (!nameResult.success) {
          setError(nameResult.message);
          return;
        }
        console.log("Name update Success");
        setUser({ email, name: name });
        // Don't set logged in yet - wait until onboarding is finished
        onNext("onboard");
      } catch (nameErr: any) {
        console.error("Name update Error:", nameErr);
        setError(nameErr.message || "Something went wrong with name update");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setError("");
    setIsLogin(!isLogin);
    // Clear form when switching modes
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  return (
    <div className="drag h-screen flex items-center rounded-md justify-center  relative p-2 gap-2">
      <div className="w-1/2 shrink-0 flex flex-col select-none">
        <div className="flex items-center tracking-tighter justify-center text-[40px] gap-1">
          <img
            src={logo}
            alt="Onboarding"
            className="size-[30px] rounded-full"
          />
          Rae
        </div>
        <div className="flex items-center justify-center">
          <p className="text-sm text-stone-400 ">
            {isLogin
              ? "Welcome, please sign in to continue"
              : "Create your account to get started"}
          </p>
        </div>
        <div className="w-[300px] flex flex-col mx-auto mt-4 gap-2 no-drag">
          {!isLogin && (
            <>
              <Input
                type="text"
                autoComplete="false"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}
          <Input
            type="email"
            autoComplete="false"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="false"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!isLogin && (
            <>
              <Input
                type="password"
                autoComplete="false"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <div className="w-full flex items-center justify-center">
                <Loader className="animate-spin" />
              </div>
            ) : isLogin ? (
              "Log in"
            ) : (
              "Create Account"
            )}
          </Button>
          <Button
            className="from-stone-800 to-stone-900 hover:to-stone-800 hover:from-stone-700"
            onClick={handleToggleMode}
            disabled={loading}
          >
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </Button>
        </div>
      </div>
      <div className="size-full relative overflow-hidden rounded-sm">
        <img
          src={onboardingImage}
          alt="Onboarding"
          className="w-full h-full absolute object-cover "
        />
      </div>
    </div>
  );
};

export default Welcome;
