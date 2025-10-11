import type { Dispatch, SetStateAction } from "react";

export const getImagesToSend = (
  attachedImages: string[],
  isActive?: boolean,
  windowScreenshot?: string,
) => {
  let imgs = attachedImages;
  if (isActive && windowScreenshot) {
    if (!imgs.includes(windowScreenshot)) imgs = [windowScreenshot, ...imgs];
  }
  return imgs.slice(0, 3);
};

export const addReferencedImage = (
  setAttachedImages: Dispatch<SetStateAction<string[]>>,
  imageBase64: string,
) => {
  setAttachedImages((prev) => {
    if (prev.length >= 3) return prev;
    return [...prev, imageBase64];
  });
};

export const removeAttachedImage = (
  setAttachedImages: Dispatch<SetStateAction<string[]>>,
  idx: number,
) => {
  setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
};

export const handlePasteImage = (
  e: React.ClipboardEvent,
  setAttachedImages: Dispatch<SetStateAction<string[]>>,
) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf("image") !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setAttachedImages((prev) => {
            if (prev.length >= 3) return prev;
            return [...prev, base64];
          });
        };
        reader.readAsDataURL(file);
      }
      break;
    }
  }
};

export const openFileSelector = (
  setAttachedFiles: Dispatch<SetStateAction<any[]>>,
) => {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = "*/*";

  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
      Array.from(files).forEach((file) => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Maximum size is 10MB.`);
          return;
        }

        // For text files, also store the text content
        if (
          file.type.startsWith("text/") ||
          file.name.toLowerCase().endsWith(".txt") ||
          file.name.toLowerCase().endsWith(".js") ||
          file.name.toLowerCase().endsWith(".ts") ||
          file.name.toLowerCase().endsWith(".py") ||
          file.name.toLowerCase().endsWith(".json") ||
          file.name.toLowerCase().endsWith(".md") ||
          file.name.toLowerCase().endsWith(".html") ||
          file.name.toLowerCase().endsWith(".css") ||
          file.name.toLowerCase().endsWith(".xml")
        ) {
          const textReader = new FileReader();
          textReader.onload = (textEvent) => {
            const textContent = textEvent.target?.result as string;
            const base64Reader = new FileReader();
            base64Reader.onload = (base64Event) => {
              const base64 = base64Event.target?.result as string;
              setAttachedFiles((prev) => {
                if (prev.length >= 5) return prev;
                return [
                  ...prev,
                  {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    content: base64,
                    textContent: textContent,
                  },
                ];
              });
            };
            base64Reader.readAsDataURL(file);
          };
          textReader.readAsText(file);
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setAttachedFiles((prev) => {
              if (prev.length >= 5) return prev;
              return [
                ...prev,
                { name: file.name, type: file.type, size: file.size, content: base64 },
              ];
            });
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  input.click();
};

export const removeAttachedFile = (
  setAttachedFiles: Dispatch<SetStateAction<any[]>>,
  idx: number,
) => {
  setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
};
