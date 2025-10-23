import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import Welcome from "./steps/Welcome";
import Onboard from "./steps/Onboard";

const Onboarding: React.FC = () => {
  const [step, setStep] = useState<string>("welcome");
  const navigate = useNavigate();
  const { setLoggedIn } = useUserStore();

  useEffect(() => {
    const unlisten = listen("onboarding_done", () => {
      if (step == "magic_dot") {
        setStep("finish");
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Ensure magic-dot creation is enabled while onboarding flows require it
  useEffect(() => {
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("set_magic_dot_creation_enabled", { enabled: true }).catch(
        () => {},
      );
    });
  }, []);

  const [shrunk, setShrunk] = useState<boolean>(false);

  const handleFinishOnboarding = () => {
    // Set user as logged in only when onboarding is completely finished
    setLoggedIn(true);
    // Navigate to main app after onboarding is complete
    navigate("/app/chat");
  };

  // Auto-transition from fetchInfo to onboard after a delay
  useEffect(() => {
    if (step === "fetchInfo") {
      const timer = setTimeout(() => {
        setStep("onboard");
      }, 2000); // 2 second delay to show loading

      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div
      className="min-h-screen flex flex-col rounded-lg overflow-hidden transition-transform duration-300 ease-in-out"
      style={{
        transform: `scale(${shrunk ? 0.9 : 1})`,
        transformOrigin: "top center",
      }}
    >
      <div className="bg-background text-foreground flex-grow">
        {step === "welcome" && <Welcome onNext={setStep} />}
        {step === "onboard" && (
          <Onboard onNext={setStep} onFinish={handleFinishOnboarding} />
        )}
        {step === "fetchInfo" && (
          <div className="drag h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-surface mx-auto mb-4"></div>
              <p className="text-lg">Setting up your account...</p>
            </div>
          </div>
        )}
        {step === "finish" && (
          <div className="drag h-screen flex items-center justify-center">
            <div className="text-center max-w-md">
              <h1 className="text-4xl font-bold mb-4">Welcome to Rae!</h1>
              <p className="text-lg text-stone-400 mb-8">
                Your AI assistant is ready to help you.
              </p>
              <button
                onClick={handleFinishOnboarding}
                className="px-6 py-3 bg-surface hover:bg-surface/80 rounded-sm transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
