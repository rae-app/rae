{/*
  This is the main app component.
  It is the root component for the app.
  It is used to wrap the app and provide the app shell.
  It is also used to provide the app context.
*/}

import { Outlet, useNavigate } from "react-router-dom";
import Titlebar from "@/components/app/Titlebar";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "@/components/app/Sidebar";


export default function MainApp() {
  const navigate = useNavigate();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ navigate?: boolean }>("rae:transfer-chat", (event) => {
      if (event?.payload?.navigate) {
        navigate("/app/chat");
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [navigate]);

  // Ensure magic-dot can be created whenever the app shell is mounted (e.g., after login).
  useEffect(() => {
    // Re-enable magic-dot creation
    invoke("set_magic_dot_creation_enabled", { enabled: true }).catch(() => {});
    return () => {
      // nothing to cleanup here related to global shortcuts
    };
  }, []);

  return (
    <div className="rounded-lg  size-full overflow-hidden flex flex-col relative">
      <Titlebar />
      <div className="flex size-full overflow-hidden" >
        <Sidebar />
        <Outlet />
      </div>
    </div>
  );
}
