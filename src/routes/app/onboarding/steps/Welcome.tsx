import React from "react";
import { useEffect } from "react";
import { useUserStore } from "@/store/userStore";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Button from "@/components/ui/Button";
import { motion } from "motion/react";

interface WelcomeProps {
  onNext: (step: string) => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onNext }) => {
  const { loggedIn, showSplash, setShowSplash } = useUserStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Close any stray magic dot once on load; avoid repeated closing to allow user toggles
    invoke("close_magic_dot").catch(console.error);
  }, []);
  const handleNext = () => {
    onNext("auth");
  };
  return (
    <div className="drag min-h-screen flex items-center rounded-md justify-center  relative">
      <div className="text-center p-8 z-[1000]">
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "circInOut", type: "tween" }}
          className="text-6xl !font-instrument-sans !tracking-tighter  mb-2 flex gap-2 justify-center items-center"
        >
          <motion.div
            
            
            className="aspect-square rounded-full shrink-0 size-[52px] border-8 border-surface h-full"
          ></motion.div>
          <motion.div>
            Rae
          </motion.div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: "circInOut",
            type: "tween",
            delay: 0.1,
          }}
          className="text-smd  font-medium  mb-5"
        >
          Your personal assistant
        </motion.p>
        
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              ease: "circInOut",
              type: "tween",
              delay: 0.2,
            }}
          >
            <Button className="hover:dark:bg-surface/70 dark:bg-surface " onClick={() => handleNext()}>
              Get started
            </Button>
          </motion.div>
        
      </div>
    </div>
  );
};

export default Welcome;
