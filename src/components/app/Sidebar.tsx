
import {
  ChatIcon,
  GearSixIcon,
  HouseIcon,
  BrainIcon,
  SparkleIcon,
  NotePencilIcon,
  PencilIcon,
  CaretDoubleLeftIcon,
} from "@phosphor-icons/react";
import { MAGIC_DOT_TOGGLE_COMBO } from "@/constants/shortcuts";
import { useUserStore } from "@/store/userStore";
import { invoke } from "@tauri-apps/api/core";
import { isRegistered, unregister } from "@tauri-apps/plugin-global-shortcut";
import {
  Home,
  LogOut,
  MessageSquare,
  Brain,
  Settings,
  Sparkle,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useChatStore } from "@/store/chatStore";

export const SidebarButton = ({
  children,
  onClick,
  expanded = true,
  active = false,
  logo,
}: {
  children: ReactNode;
  onClick: () => void;
  expanded?: boolean;
  logo: ReactNode;
  active?: boolean;
}) => {
  return (
    <motion.button
      whileHover={"hover"}
      initial={{
        paddingInline: expanded ? "0px" : "0px",
        fontSize: expanded ? "14px" : "14px",
      }}
      animate={{
        paddingInline: expanded ? "0px" : "0px",
        fontSize: expanded ? "14px" : "14px",
        // paddingBlock: expanded ? "20px" : "0px",
      }}
      onClick={onClick}
      className={`w-full shrink-0 group h-[44px]  flex items-center overflow-hidden rounded-lg dark:bg-zinc-800/20 cursor-pointer dark:hover:text-white ${
        active && "dark:!bg-zinc-800 dark:!text-white"
      } dark:hover:bg-zinc-800 transition-colors flex-nowrap whitespace-nowrap dark:text-zinc-400 font-medium duration-100`}
    >
      <motion.div
        animate={{
          fontSize: expanded ? "14px" : "20px",
        }}
        className="h-full aspect-square flex items-center justify-center shrink-0"
      >
        {logo}
      </motion.div>
      <motion.div className="min-w-fit w-full pr-4 text-left" animate={{ opacity: !expanded == true ? 0 : 1 }}>
        {children}
      </motion.div>
    </motion.button>
  );
};

const Sidebar = () => {
  const navigate = useNavigate();
  const { clearUser } = useUserStore();
  const { convoHistory, setCurrentConvo, currentConvoId } = useChatStore();
  
  // Log all convo titles on render and whenever convoHistory changes
  useEffect(() => {
    if (Array.isArray(convoHistory)) {
      console.log(
        "Convo titles:",
        convoHistory.map((c) => c.title)
      );
    }
  }, [convoHistory]);
  const handlelogout = async () => {
    clearUser();
    invoke("set_magic_dot_creation_enabled", { enabled: false }).catch(
      console.error
    );
    invoke("close_magic_dot").catch(console.error);
    try {
      if (await isRegistered(MAGIC_DOT_TOGGLE_COMBO)) {
        await unregister(MAGIC_DOT_TOGGLE_COMBO);
      }
    } catch (e) {
      console.warn("Failed to unregister global shortcut on logout", e);
    }
    navigate("/");
  };
  const { name, email } = useUserStore();
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    console.log("Current convo ID:", currentConvoId);
  }, [currentConvoId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "b" && e.ctrlKey) {
        setExpanded((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  });
  // ...existing code...
  return (
    <motion.div
      animate={{ width: expanded ? "300px" : "60px" }}
      transition={{ ease: "circInOut", duration: 0.3 }}
      className="border-r border-border text-foreground overflow-hidden bg-background py-[2px] shrink-0 h-full flex flex-col overflow-y-auto"
    >
      <div className="w-full shrink-0 h-[56px] flex p-2 pb-1 justify-end overflow-hidden items-center">
        <motion.div
          animate={{ opacity: expanded ? 1 : 0 }}
          className=" px-4  font-mono text-sm dark:text-zinc-700 font-black whitespace-nowrap pointer-events-none text-left w-full"
        >
          CTRL + B
        </motion.div>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="h-full shrink-0 aspect-square flex items-center justify-center dark:hover:bg-zinc-800 dark:text-zinc-400 hover:dark:text-white transition-colors duration-100 rounded-lg dark:bg-zinc-900/50"
        >
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, rotateZ: !expanded ? 180 : 0 }}
              transition={{ ease: "circInOut", duration: 0.2 }}
            >
              <CaretDoubleLeftIcon />
            </motion.div>
          </AnimatePresence>
        </button>
      </div>
      {/* Chat history section - empty clickable divs */}
      <div className="flex flex-col gap-1 px-2 mb-2 overflow-hidden">
        <SidebarButton
          active={location.pathname == "/app/settings"}
          logo={
            <motion.div
              variants={{
                hover: {
                  rotate: "45deg",
                },
              }}
              transition={{ duration: 0.2, ease: "easeInOut", type: "tween" }}
              className=""
            >
              <PencilIcon  className="" />
            </motion.div>
          }
          expanded={expanded}
          onClick={() => {
            // setExpanded(false)
            setCurrentConvo(-1);
            navigate("/app/chat");
          }}
        >
          New chat
        </SidebarButton>
        <div className="flex overflow-hidden relative">
          {/* <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-background/50 to-transparent h-[40px] z-30" ></div> */}
          <motion.div animate={{opacity: expanded ? 1 : 0}} className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden relative">
          
          {Array.isArray(convoHistory) &&
            convoHistory.map((convo) => (
              <div
                key={convo.id}
                className={`dark:bg-zinc-900/0 ${currentConvoId == convo.id ? "dark:!bg-zinc-800 dark:!text-zinc-200" : ""} h-[32px] items-center shrink-0 whitespace-nowrap px-4 rounded-lg overflow-hidden dark:text-zinc-400 hover:dark:bg-zinc-800 transition-colors duration-100 cursor-pointer text-sm font-medium py-2`}
                onClick={() => {
                  console.log("Selected chat:", convo.title);
                  console.log("Chat messages:", convo);
                  setCurrentConvo(convo.id);
                  navigate("/app/chat");
                }}
              >
                {typeof convo.title == "string"
                  ? convo.title.replace(`"`, "")
                  : "Invalid title"}
              </div>
            ))}
        </motion.div>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-1 px-2">
        <SidebarButton
          active={location.pathname == "/app/brain"}
          logo={<BrainIcon className=" " />}
          expanded={expanded}
          onClick={() => {
            navigate("/app/brain");
            // setExpanded(false)
          }}
        >
          Memory
        </SidebarButton>
        <SidebarButton
          active={location.pathname.includes("/app/settings")}
          logo={
            <motion.div
              variants={{
                hover: {
                  rotate: "45deg",
                },
              }}
              transition={{ duration: 0.2, ease: "easeInOut", type: "tween" }}
              className=""
            >
              <GearSixIcon  className="" />
            </motion.div>
          }
          expanded={expanded}
          onClick={() => {
            setExpanded(false)
            navigate("/app/settings/preferences");
          }}
        >
          Settings
        </SidebarButton>
      </div>
      <motion.div
        animate={{ height: expanded ? "70px" : "60px" }}
        className="w-full p-2"
      >
        <button onClick={() => handlelogout()} className="rounded-lg overflow-hidden w-full h-full p-2 flex dark:hover:bg-zinc-800 transition-colors duration-100 cursor-pointer  dark:bg-zinc-800/20 dark:text-white gap-2">
          <div className="h-full aspect-square shrink-0 rounded-full bg-surface"></div>
          <motion.div animate={{ opacity: expanded ? 1 : 0 }} className=" flex flex-col items-start">
            <div className="text-sm font-medium dark:text-zinc-200 ">
              {name}
            </div>
            <div className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-white to-transparent">
              {email}
            </div>
          </motion.div>
        </button>
      </motion.div>
    </motion.div>
  );
};

export default Sidebar;
