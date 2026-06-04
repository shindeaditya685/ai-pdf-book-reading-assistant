"use client";

import { useState, useRef, useEffect } from "react";
import {
  MousePointer,
  Highlighter,
  PenTool,
  Eraser,
  MessageSquarePlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { usePDFStore } from "@/store/use-pdf-store";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "@/lib/api";

const HIGHLIGHT_COLORS = [
  {
    value: "rgba(253, 224, 71, 0.65)",
    label: "Yellow",
    tailwind: "bg-yellow-400 border-yellow-500",
  },
  {
    value: "rgba(74, 222, 128, 0.65)",
    label: "Green",
    tailwind: "bg-green-400 border-green-500",
  },
  {
    value: "rgba(244, 114, 182, 0.65)",
    label: "Pink",
    tailwind: "bg-pink-400 border-pink-500",
  },
  {
    value: "rgba(96, 165, 250, 0.65)",
    label: "Blue",
    tailwind: "bg-blue-400 border-blue-500",
  },
];

const PEN_COLORS = [
  { value: "#EF4444", tailwind: "bg-red-500", label: "Red" },
  { value: "#3B82F6", tailwind: "bg-blue-500", label: "Blue" },
  { value: "#10B981", tailwind: "bg-emerald-500", label: "Green" },
  { value: "#F59E0B", tailwind: "bg-amber-500", label: "Yellow" },
  { value: "#8B5CF6", tailwind: "bg-purple-500", label: "Purple" },
  { value: "#1F2937", tailwind: "bg-gray-800", label: "Black" },
];

type OpenPanel = "highlight" | "pen" | null;

export function AnnotationToolbar({ onClearAll }: { onClearAll: () => void }) {
  const {
    annotationMode,
    setAnnotationMode,
    highlightColor,
    setHighlightColor,
    penColor,
    setPenColor,
    penWidth,
    setPenWidth,
    pdfFileName,
    undo,
    redo,
    undoStack,
    redoStack,
    ocrText,
    currentPage,
  } = usePDFStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [showSummarizer, setShowSummarizer] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside the toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        setOpenPanel(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  if (!pdfFileName) return null;

  return (
    <div ref={toolbarRef} className="contents">
      {/* Toggle button — fixed position, never shifts */}
      <div className="fixed left-3 top-1/2 z-40 -translate-y-1/2 pointer-events-auto select-none">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 rounded-full bg-background/95 shadow-md border hover:bg-muted"
          onClick={() => {
            setIsMinimized(!isMinimized);
            setOpenPanel(null);
          }}
          title={isMinimized ? "Show Toolbar" : "Hide Toolbar"}
        >
          {isMinimized ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Toolbar — independently centered */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, x: -12, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-[calc(0.75rem+28px+4px)] top-32 z-40  pointer-events-auto select-none flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-background/95 p-1.5 shadow-2xl backdrop-blur-md"
          >
            {/* ── 1. SELECT ── */}
            <ToolBtn
              active={annotationMode === "select"}
              onClick={() => {
                setAnnotationMode("select");
                setOpenPanel(null);
              }}
              title="Select / Dictionary Mode"
            >
              <MousePointer className="h-4 w-4" />
            </ToolBtn>

            {/* ── 2. HIGHLIGHT ── */}
            <div className="relative">
              <ToolBtn
                active={annotationMode === "highlight"}
                panelOpen={openPanel === "highlight"}
                onClick={() => {
                  setAnnotationMode("highlight");
                  togglePanel("highlight");
                }}
                title="Highlight (click for colours)"
              >
                <Highlighter className="h-4 w-4" />
              </ToolBtn>

              {/* ── 7. SUMMARIZE PAGE ── */}
              <ToolBtn
                active={false}
                panelOpen={false}
                onClick={() => setShowSummarizer(true)}
                title="Summarize Page"
              >
                <Sparkles className="h-4 w-4" />
              </ToolBtn>

              <AnimatePresence>
                {openPanel === "highlight" && (
                  <Popover>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Highlight colour
                    </p>
                    <div className="flex gap-2">
                      {HIGHLIGHT_COLORS.map((c) => (
                        <ColorSwatch
                          key={c.value}
                          tailwind={c.tailwind}
                          label={c.label}
                          active={highlightColor === c.value}
                          onClick={() => {
                            setHighlightColor(c.value);
                            setAnnotationMode("highlight");
                            setOpenPanel(null);
                          }}
                        />
                      ))}
                    </div>
                  </Popover>
                )}
              </AnimatePresence>
            </div>

            {/* ── 3. PEN ── */}
            <div className="relative">
              <ToolBtn
                active={annotationMode === "pen"}
                panelOpen={openPanel === "pen"}
                onClick={() => {
                  setAnnotationMode("pen");
                  togglePanel("pen");
                }}
                title="Freehand Pen (click for options)"
              >
                <PenTool className="h-4 w-4" />
              </ToolBtn>

              <AnimatePresence>
                {openPanel === "pen" && (
                  <Popover wide>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Pen colour
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {PEN_COLORS.map((c) => (
                        <ColorSwatch
                          key={c.value}
                          tailwind={c.tailwind}
                          label={c.label}
                          active={penColor === c.value}
                          onClick={() => {
                            setPenColor(c.value);
                            setAnnotationMode("pen");
                          }}
                        />
                      ))}
                    </div>
                    <div className="border-t border-border pt-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          Thickness
                        </p>
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {penWidth}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={penWidth}
                        onChange={(e) => setPenWidth(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-muted"
                      />
                    </div>
                  </Popover>
                )}
              </AnimatePresence>
            </div>

            {/* ── 4. ERASER ── */}
            <ToolBtn
              active={annotationMode === "eraser"}
              onClick={() => {
                setAnnotationMode("eraser");
                setOpenPanel(null);
              }}
              title="Eraser"
            >
              <Eraser className="h-4 w-4" />
            </ToolBtn>

            {/* ── 5. STICKY NOTE ── */}
            <ToolBtn
              active={annotationMode === "note"}
              onClick={() => {
                setAnnotationMode("note");
                setOpenPanel(null);
              }}
              title="Add Sticky Note"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </ToolBtn>

            <div className="my-0.5 border-t border-border/60" />

            {/* Undo/Redo buttons */}
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              title="Undo last annotation"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-all active:scale-90"
            >
              <Undo2 className="h-4 w-4" />
            </button>

            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              title="Redo last annotation"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-all active:scale-90"
            >
              <Redo2 className="h-4 w-4" />
            </button>

            <div className="my-0.5 border-t border-border/60" />

            {/* ── 6. CLEAR ALL ── */}
            <button
              onClick={() => {
                onClearAll();
                setOpenPanel(null);
              }}
              title="Clear all page annotations"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all active:scale-90"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* ── 7. SUMMARIZE PANEL ── */}
            <AnimatePresence>
              {showSummarizer && (
                <motion.div
                  initial={{ opacity: 0, x: -12, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -12, scale: 0.96 }}
                  transition={{ duration: 0.14 }}
                  className="absolute left-[calc(100%+10px)] top-0 z-50 w-72 rounded-xl border border-border bg-background/98 p-3 shadow-xl backdrop-blur-md"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-foreground">
                      Summarize Page
                    </p>
                    <button
                      onClick={() => {
                        setShowSummarizer(false);
                        setSummary("");
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {!summary && !summarizing && (
                    <button
                      onClick={async () => {
                        setSummarizing(true);
                        const pageData = ocrText[currentPage];
                        const text = pageData?.text || "";
                        // Fall back to pageText if available
                        const pageText =
                          text ||
                          (globalThis as any).__pageText?.[currentPage] ||
                          "";
                        if (!pageText) {
                          setSummary(
                            "No text available for this page. Enable OCR or load a text-based PDF.",
                          );
                          setSummarizing(false);
                          return;
                        }
                        try {
                          const res = await authFetch("/api/simplify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              text: pageText.slice(0, 3000),
                              action: "summarize",
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setSummary(
                              data.simplified ||
                                data.summary ||
                                "No summary returned.",
                            );
                          } else {
                            setSummary("Failed to generate summary.");
                          }
                        } catch {
                          setSummary("An error occurred.");
                        }
                        setSummarizing(false);
                      }}
                      className="w-full rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                    >
                      Generate Summary
                    </button>
                  )}

                  {summarizing && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                    </div>
                  )}

                  {summary && !summarizing && (
                    <div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {summary}
                      </p>
                      <button
                        onClick={() => {
                          setSummary("");
                          setShowSummarizer(false);
                        }}
                        className="mt-2 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Small shared sub-components ─────────────────────────────── */

function ToolBtn({
  active,
  panelOpen,
  onClick,
  title,
  children,
}: {
  active: boolean;
  panelOpen?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90
        ${
          active
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
            : panelOpen
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}

function Popover({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -6, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      className={`absolute left-[calc(100%+10px)] top-0 z-50 rounded-xl border border-border bg-background/98 p-3 shadow-xl backdrop-blur-md ${wide ? "w-44" : "w-auto"}`}
      // Prevent clicks inside the popover from propagating to the PDF canvas
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  );
}

function ColorSwatch({
  tailwind,
  label,
  active,
  onClick,
}: {
  tailwind: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-125 active:scale-95
        ${tailwind}
        ${active ? "ring-2 ring-emerald-500 ring-offset-1 border-white" : "border-transparent"}`}
    />
  );
}
