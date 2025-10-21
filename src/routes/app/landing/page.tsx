import { LaunchOverlayWindow } from "@/routes/overlay/components/OverlayLauncher";
import { useUserStore } from "@/store/userStore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/app/SplashScreen";
import { motion } from "motion/react";
import Button from "@/components/ui/Button";
import { Send } from "lucide-react";

export default function Landing() {
  const { name, loggedIn, showSplash, setShowSplash } = useUserStore();
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Only launch the magic dot when logged in, but delay it to improve startup speed
    if (loggedIn) {
      // Delay overlay launch by 1 second to prioritize main app loading
      const timer = setTimeout(() => {
        LaunchOverlayWindow();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loggedIn]);

  const handleSend = () => {
    if (message.trim()) {
      // Navigate to chat page immediately
      navigate(`/app/chat?message=${encodeURIComponent(message.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onFadeOut={() => setShowSplash(false)} />}
      <div className="h-full flex w-full flex-col items-center justify-center overflow-hidden text-foreground ">
        <div className="bg-background w-full flex flex-col items-center justify-center flex-grow p-8">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "circInOut" }}
            className="text-3xl mb-8 font-instrument-sans tracking-tighter font-semibold"
          >
            Welcome back, {name?.split(" ")[0]}
          </motion.div>

          {/* Input area at bottom */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "circInOut", delay: 0.2 }}
            className="w-full max-w-lg mx-auto"
          >
            <div className="bg-card border border-border rounded-lg p-1 group focus-within:border-foreground/20 transition-all">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Rae anything..."
                  className="flex-1 bg-transparent outline-none text-sm px-3 py-3 placeholder:text-foreground/40"
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className={`shrink-0 p-2 rounded-md transition-all ${
                    !message.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-foreground/10"
                  }`}
                  variant="text"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
