import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect } from "react";

// Fallback generic site icon for when favicon loading fails
const GENERIC_SITE_ICON = "data:image/svg+xml;base64," + btoa(`
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#6b7280" stroke="#374151" stroke-width="1"/>
    <path d="M12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="white"/>
    <circle cx="12" cy="6" r="1" fill="white"/>
  </svg>
`);

interface WebSearchAnimationProps {
  isSearching: boolean;
  searchQuery?: string;
  isResponseStreaming?: boolean;
  onSearchSiteFound?: (site: { site: string; domain: string; favicon: string; title: string; link: string }) => void;
}

interface SearchSite {
  site: string;
  domain: string;
  favicon: string;
  title: string;
  link: string;
}

export const WebSearchAnimation = ({ isSearching, searchQuery, isResponseStreaming = false, onSearchSiteFound }: WebSearchAnimationProps) => {
  console.log("WebSearchAnimation rendered:", { isSearching, searchQuery, isResponseStreaming });
  const [currentSiteIndex, setCurrentSiteIndex] = useState(0);
  const [realSearchSites, setRealSearchSites] = useState<SearchSite[]>([]);
  const [usingRealData, setUsingRealData] = useState(false);

  // Add a site from real search results
  const addRealSearchSite = (site: SearchSite) => {
    console.log("addRealSearchSite called with:", site);
    console.log("Favicon URL:", site.favicon);
    setRealSearchSites(prev => {
      const exists = prev.find(s => s.domain === site.domain);
      if (!exists) {
        console.log("Adding real site:", site.site, "with favicon:", site.favicon);
        // Replace demo sites with real ones as they come in
        const newSites = [...prev, site];
        // Set to show the newly added site
        setCurrentSiteIndex(newSites.length - 1);
        setUsingRealData(true);
        return newSites;
      } else {
        console.log("Site already exists:", site.site);
      }
      return prev;
    });
  };

  // Expose the addRealSearchSite function to parent
  React.useEffect(() => {
    console.log("Setting up addRealSearchSite on window");
    (window as any).addRealSearchSite = addRealSearchSite;

    // Cleanup function to remove from window when component unmounts
    return () => {
      (window as any).addRealSearchSite = undefined;
    };
  }, []);

  useEffect(() => {
    if (!isSearching) {
      setCurrentSiteIndex(0);
      setRealSearchSites([]);
      setUsingRealData(false);
      return;
    }

    // Reset for new search - wait for real sites from backend
    setRealSearchSites([]);
    setUsingRealData(false);
    setCurrentSiteIndex(0);
  }, [isSearching, searchQuery]);

  // Cycle through sites after we have some real data, but not during streaming
  useEffect(() => {
    if (usingRealData && realSearchSites.length > 1 && !isResponseStreaming) {
      const interval = setInterval(() => {
        setCurrentSiteIndex(prev => (prev + 1) % realSearchSites.length);
      }, 1000); // Change site every 1 second

      return () => clearInterval(interval);
    }
  }, [usingRealData, realSearchSites.length, isResponseStreaming]);

  if (!isSearching) return null;

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        className="flex flex-col gap-3 mt-2 mx-2 dark:text-zinc-200 font-medium items-start text-sm h-fit"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Main Rae logo with searching animation and site icons */}
        <div className="flex gap-3 items-center">
          {!isResponseStreaming && (
            <motion.div
              initial={{ borderRadius: "0%", rotate: "90deg" }}
              animate={{
                borderRadius: ["0%", "50%", "0%"],
                rotate: ["90deg", "180deg", "270deg"],
              }}
              transition={{
                duration: 1,
                ease: "linear",
                repeat: Infinity,
                repeatType: "loop",
              }}
              className="self-start flex items-center relative border-[3px] border-surface size-[20px] justify-center"
            ></motion.div>
          )}

          <div className="flex flex-col gap-1">
            {/* Rae is searching text with site icons */}
            <div className="flex items-center gap-2">
              {!isResponseStreaming && (
                <span className="animate-pulse font-semibold">Rae is searching...</span>
              )}

              {/* Show site icons when we have real data but not during response streaming */}
              <AnimatePresence mode="popLayout">
                {usingRealData && realSearchSites.length > 0 && !isResponseStreaming && (
                  <motion.div
                    className="flex items-center gap-1"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                  >
                    {realSearchSites.slice(0, 5).map((site, index) => (
                      <motion.div
                        key={`${site.domain}-${index}`}
                        animate={index === currentSiteIndex % realSearchSites.length ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                        transition={{ duration: 0.6, repeat: index === currentSiteIndex % realSearchSites.length ? Infinity : 0, repeatType: "loop" }}
                        className="size-5 flex items-center justify-center rounded-sm overflow-hidden border border-zinc-600/20"
                      >
                        <img
                          src={site.favicon}
                          alt={site.site}
                          className="size-full object-contain"
                          onLoad={() => console.log("Favicon loaded successfully:", site.favicon)}
                          onError={(e) => {
                            console.error("Favicon failed to load:", site.favicon, "falling back to generic icon");
                            // Fallback to the generic icon if favicon fails to load
                            (e.target as HTMLImageElement).src = GENERIC_SITE_ICON;
                          }}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Currently searching site name - show if we have real data and not during response streaming */}
            <AnimatePresence mode="wait">
              {usingRealData && realSearchSites[currentSiteIndex] && !isResponseStreaming ? (
                <motion.div
                  key={`real-${currentSiteIndex}`}
                  className="flex items-center gap-2 text-xs"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-zinc-400">
                    Searching {realSearchSites[currentSiteIndex].site}...
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
};

export default WebSearchAnimation;
