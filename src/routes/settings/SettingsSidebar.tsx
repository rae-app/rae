import { Keyboard, Search, Wrench } from "lucide-react";
import { motion } from "motion/react";
import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ConnectX from "@/components/misc/ConnectX";
import { useUserStore } from "@/store/userStore";
import { CommandIcon, WrenchIcon } from "@phosphor-icons/react";
import { SidebarButton } from "@/components/app/Sidebar";
const SettingsButton = ({
  children,
  icon,
  to,
}: {
  children: ReactNode;
  icon: ReactNode;
  to: string;
}) => {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    console.log("Checking active for", to, "current path:", location.pathname);
    if (location.pathname == to) {
      console.log("Setting active for", to);
      setLoading(false);
      setActive(true);
    } else {
      setActive(false);
    }
  }, [location]);
  const navigate = useNavigate();
  return (
    <motion.div
      onClick={() => {
        setLoading(true);
        navigate(to);
      }}
      className="px-[4px] py-[2px] group w-fit overflow-visible"
    >
      <motion.button
        className={`flex rounded-md ${active ? "dark:bg-stone-800 text-foreground" : "text-foreground/40 group-hover:bg-foreground/10"} h-[42px] w-[180px] text-foreground relative  items-center justify-center  shrink-0 overflow-visible transition-colors duration-75 ${
          loading ? "bg-foreground/10" : "bg-background "
        }`}
      >
        <div className="size-full px-4 group-hover:text-foreground py-2 flex gap-2 items-center  font-medium text-sm">
          {icon} {children}
        </div>
      </motion.button>
    </motion.div>
  );
};

const SettingsSidebar = () => {
  const { email } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="h-full flex-col border-r border-border flex w-[200px] shrink-0 bg-background p-2 gap-1">
      {/* <div className="relative h-[44px] dark:bg-stone-950 focus-within:dark:bg-stone-950 rounded-lg transition-all duration-100 border-2  dark:border-stone-900 focus-within:dark:border-stone-800">
              <input
                type="text"

                autoFocus


                placeholder="Search"
                className="w-full px-4 dark:focus:placeholder:text-stone-400/0 placeholder:transition-colors h-full bg-transparent text-foreground placeholder:text-foreground/50 text-sm outline-none pr-12"
              />


            </div> */}
      <SidebarButton
        active={location.pathname == "/app/settings/preferences"}
        onClick={() => navigate("/app/settings/preferences")}
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
            <WrenchIcon weight="bold" className="" />
          </motion.div>
        }
      >
        Preferences
      </SidebarButton>
      <SidebarButton
        active={location.pathname == "/app/settings/shortcuts"}
        onClick={() => navigate("/app/settings/shortcuts")}
        logo={
          <motion.div
            variants={{
              hover: {
                rotate: "90deg",
              },
            }}
            transition={{ duration: 0.2, ease: "easeInOut", type: "tween" }}
            className=""
          >
            <CommandIcon weight="bold" className="" />
          </motion.div>
        }
      >
        Shortcuts
      </SidebarButton>

      {/*<ConnectX
        provider="notion" // or "google-drive" / "one-drive"
        email={email}
      />
      <ConnectX
        provider="one-drive" // or "google-drive" / "one-drive"
        email={email}
      />*/}
    </div>
  );
};

export default SettingsSidebar;
