import Button from "@/components/ui/Button";
import React, { useState } from "react";
import atVideo from "@/assets/videos/at-rae.mp4";
import copyVideo from "@/assets/videos/copy.mp4";
import raeVideo from "@/assets/videos/rae.mp4";
import listeningVideo from "@/assets/videos/listening.mp4";

import { motion, AnimatePresence } from "motion/react";

function Onboard({
  onNext,
  onFinish,
}: {
  onNext: (step: string) => void;
  onFinish?: () => void;
}) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Rae",
      content: (
        <div className="w-full h-fit flex flex-col gap-4">
          <div className="w-full aspect-video shrink-0">
            <video autoPlay loop muted src={raeVideo} className="rounded-sm" />
          </div>
          <div>We're going to walk you through the basics now.</div>
        </div>
      ),
    },

    {
      title: "Rae appears where you want",
      content: (
        <div className="w-full h-fit flex flex-col gap-4">
          <div className="w-full aspect-video shrink-0">
            <video autoPlay loop muted src={atVideo} className="rounded-sm" />
          </div>
          <div>
            You just need to type{" "}
            <span className="font-dm-mono p-1 rounded-sm bg-border">@rae</span>{" "}
            anywhere on your desktop
          </div>
        </div>
      ),
    },
    {
      title: "When you want",
      content: (
        <div className="w-full h-fit flex flex-col gap-4">
          <video autoPlay loop muted src={copyVideo} className="rounded-sm" />
          <div>Copy any text on your desktop and Rae is at your service.</div>
        </div>
      ),
    },
    {
      title: "Uses your desktop as context for conversations",
      content: (
        <div className="w-full h-fit flex flex-col gap-4">
          <video
            autoPlay
            loop
            muted
            src={listeningVideo}
            className="rounded-sm"
          />
          <div>Always have interactive conversations.</div>
        </div>
      ),
    },
  ];
  return (
    <div className="drag h-screen flex flex-col items-center rounded-md justify-center  relative p-2 gap-2 select-none">
      <div className=" w-[600px] no-drag h-fit flex flex-col bg-stone-950 rounded-md">
        <div className="  w-full text-xl px-3 py-2 flex justify-between">
          {steps[step].title} <div className="text-stone-400">{step + 1}/4</div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            key={step + "onboarding"}
            className=" p-3"
          >
            {steps[step].content}
          </motion.div>
        </AnimatePresence>
        <div className="p-2 flex justify-end  no-drag  gap-2">
          {step > 0 && (
            <>
              <Button
                onClick={() =>
                  setStep((v) => {
                    if (v > 0) {
                      return v - 1;
                    }
                    return v;
                  })
                }
                className="from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800"
              >
                Back
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              if (step === steps.length - 1) {
                // On finish, call the onFinish callback if provided
                if (onFinish) {
                  onFinish();
                } else {
                  // Fallback to setting step if no onFinish provided
                  onNext("finish");
                }
              } else {
                setStep((v) => v + 1);
              }
            }}
            className=""
          >
            {step === steps.length - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Onboard;
