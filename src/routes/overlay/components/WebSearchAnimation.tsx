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
  onSearchSiteFound?: (site: { site: string; domain: string; favicon: string; title: string; link: string }) => void;
}

interface SearchSite {
  site: string;
  domain: string;
  favicon: string;
  title: string;
  link: string;
}

export const WebSearchAnimation = ({ isSearching, searchQuery, onSearchSiteFound }: WebSearchAnimationProps) => {
  const [currentSiteIndex, setCurrentSiteIndex] = useState(0);
  const [realSearchSites, setRealSearchSites] = useState<SearchSite[]>([]);
  const [usingRealData, setUsingRealData] = useState(false);

  // Add a site from real search results
  const addRealSearchSite = (site: SearchSite) => {
    setRealSearchSites(prev => {
      const exists = prev.find(s => s.domain === site.domain);
      if (!exists) {
        const newSites = [...prev, site];
        setCurrentSiteIndex(newSites.length - 1);
        return newSites;
      }
      return prev;
    });
    setUsingRealData(true);
  };

  // Expose the addRealSearchSite function to parent
  React.useEffect(() => {
    if (onSearchSiteFound) {
      (window as any).addRealSearchSite = addRealSearchSite;
    }
  }, [onSearchSiteFound]);

  useEffect(() => {
    if (!isSearching) {
      setCurrentSiteIndex(0);
      setRealSearchSites([]);
      setUsingRealData(false);
      return;
    }

    // Only show "Rae is searching..." when no real data is available yet
    // Real-time data will be populated via the addRealSearchSite function
  }, [isSearching, searchQuery, usingRealData]);

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
        {/* Main Rae logo with searching animation */}
        <div className="flex gap-3 items-center">
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

          <div className="flex flex-col gap-1">
            <div className="animate-pulse font-semibold">Rae is searching...</div>

            {/* Currently searching site - only show if we have real data */}
            <AnimatePresence mode="wait">
              {usingRealData && realSearchSites[currentSiteIndex] ? (
                <motion.div
                  key={`real-${currentSiteIndex}`}
                  className="flex items-center gap-2 text-xs"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatType: "loop" }}
                    className="size-4 flex items-center justify-center"
                  >
                    <img
                      src={realSearchSites[currentSiteIndex].favicon}
                      alt={realSearchSites[currentSiteIndex].site}
                      className="size-full object-contain"
                      onError={(e) => {
                        // Fallback to the generic icon if favicon fails to load
                        (e.target as HTMLImageElement).src = GENERIC_SITE_ICON;
                      }}
                    />
                  </motion.div>
                  <span className="text-zinc-400">
                    Searching {realSearchSites[currentSiteIndex].site}...
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="loading"
                  className="flex items-center gap-2 text-xs"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="size-4 flex items-center justify-center"
                  >
                    <div className="size-full border-2 border-zinc-400 border-t-transparent rounded-full"></div>
                  </motion.div>
                  <span className="text-zinc-400 animate-pulse">
                    Finding relevant sources...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
};

export default WebSearchAnimation;
