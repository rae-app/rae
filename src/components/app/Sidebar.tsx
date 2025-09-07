{
  /*
  This is the sidebar component.
  It is used to display the sidebar.
*/
}
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

const SidebarButton = ({
  children,
  onClick,
  expanded = false,
  active= false,
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
      animate={{
        paddingInline: expanded ? "0px" : "0px",
        fontSize: expanded ? "14px" : "14px",
        // paddingBlock: expanded ? "20px" : "0px",
      }}
      onClick={onClick}
      className={`w-full group h-[44px]  flex items-center overflow-hidden rounded-lg dark:bg-zinc-900/50 cursor-pointer dark:hover:text-white ${active && "dark:!bg-zinc-800 dark:!text-white"} dark:hover:bg-zinc-800 transition-colors flex-nowrap whitespace-nowrap dark:text-zinc-400 font-medium duration-100`}
    >
      <motion.div
        animate={{
          fontSize: expanded ? "14px" : "20px",
        }}
        className="h-full aspect-square flex items-center justify-center shrink-0"
      >
        {logo}
      </motion.div>
      <motion.div animate={{ opacity: !expanded == true ? 0 : 1 }}>
        {children}
      </motion.div>
    </motion.button>
  );
};

const Sidebar = () => {
  const navigate = useNavigate();
  const { clearUser } = useUserStore();
  const handlelogout = async () => {
    clearUser();
    // Disable magic dot creation and close any existing one
    invoke("set_magic_dot_creation_enabled", { enabled: false }).catch(
      console.error
    );
    invoke("close_magic_dot").catch(console.error);

    // Unregister the global shortcut to prevent toggling after logout
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
  return (
    <motion.div
      animate={{
        width: expanded ? "300px" : "60px",
      }}
      transition={{ ease: "circInOut", duration: 0.3 }}
      className="border-r  border-border text-foreground overflow-hidden bg-background  py-[2px] shrink-0 h-full  flex flex-col overflow-y-auto "
    >
      <div className="w-full h-[60px] flex p-2 justify-end">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="h-full shrink-0 aspect-square flex items-center justify-center dark:hover:bg-zinc-800 dark:text-zinc-400 hover:dark:text-white  transition-colors duration-100 rounded-lg dark:bg-zinc-900/50"
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
      <div className="flex flex-col gap-2 px-2">
        <SidebarButton
          logo={
            <motion.div
              variants={{
                hover: {
                  rotate: "45deg",
                },
              }}
              transition={{duration: 0.2, ease: "easeInOut", type: "tween"}}
              className=""
            >
              <PencilIcon className="" />
            </motion.div>
          }
          expanded={expanded}
          active={location.pathname == "/app/landing"}
          onClick={() => navigate("/app/landing")}
        >
          New Chat
        </SidebarButton>
      </div>
      <div className="mt-auto flex flex-col gap-2 px-2">
        <SidebarButton
        active={location.pathname == "/app/brain"}
          logo={
            <BrainIcon className=" " />
          }
          expanded={expanded}
          onClick={() => {
            navigate("/app/brain")
            // setExpanded(false)
          }}
        >
          Memory
        </SidebarButton>
        <SidebarButton
        active={location.pathname == "/app/settings"}
          logo={
            <motion.div
              variants={{
                hover: {
                  rotate: "45deg",
                },
              }}
              transition={{duration: 0.2, ease: "easeInOut", type: "tween"}}
              className=""
            >
              <GearSixIcon className="" />
            </motion.div>
          }
          expanded={expanded}
          onClick={() => {
            // setExpanded(false)
            navigate("/app/settings")
          }}
        >
          Settings
        </SidebarButton>
      </div>
      <motion.div
        animate={{ height: expanded ? "80px" : "60px" }}
        className="w-full p-2"
      >
        <div className="rounded-lg overflow-hidden w-full h-full p-2 flex  dark:bg-zinc-900/50 dark:text-white gap-2">
          <div className="h-full aspect-square shrink-0 rounded-full bg-surface"></div>
          <div className="h-full flex flex-col">
            <div className="text-sm font-medium dark:text-zinc-200 ">
              {name}
            </div>
            <div className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-white to-transparent">
              {email}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Sidebar;
