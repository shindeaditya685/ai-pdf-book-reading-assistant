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
} from "lucide-react";
import { usePDFStore } from "@/store/use-pdf-store";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

// Functional mark inks — these are the literal colors drawn on the page.
const HIGHLIGHT_COLORS = [
  { value: "rgba(253, 224, 71, 0.65)", label: "Yellow", tailwind: "bg-yellow-400" },
  { value: "rgba(74, 222, 128, 0.65)", label: "Green", tailwind: "bg-green-400" },
  { value: "rgba(244, 114, 182, 0.65)", label: "Pink", tailwind: "bg-pink-400" },
  { value: "rgba(96, 165, 250, 0.65)", label: "Blue", tailwind: "bg-blue-400" },
];

const PEN_COLORS = [
  { value: "#EF4444", tailwind: "bg-red-500", label: "Red" },
  { value: "#3B82F6", tailwind: "bg-blue-500", label: "Blue" },
  { value: "#10B981", tailwind: "bg-emerald-500", label: "Green" },
  { value: "#F59E0B", tailwind: "bg-amber-500", label: "Yellow" },
  { value: "#8B5CF6", tailwind: "bg-purple-500", label: "Purple" },
  { value: "#1F2937", tailwind: "bg-gray-800", label: "Ink" },
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
  } = usePDFStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Close panel when clicking outside the toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
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
      {isMobile ? (
        /* ── MOBILE: persistent bottom rail ──────────────────────────────── */
        <div className="fixed inset-x-2 bottom-2 z-40 pointer-events-auto select-none flex items-center justify-center gap-0.5 overflow-x-auto rounded-2xl border border-border/40 bg-background/90 p-1 shadow-lg backdrop-blur-xl pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <ToolBtn
            active={annotationMode === "select"}
            onClick={() => {
              setAnnotationMode("select");
              setOpenPanel(null);
            }}
            title="Select · 1"
          >
            <MousePointer className="h-4 w-4" />
          </ToolBtn>

          <div className="relative">
            <ToolBtn
              active={annotationMode === "highlight"}
              panelOpen={openPanel === "highlight"}
              pip={highlightColor}
              onClick={() => {
                setAnnotationMode("highlight");
                togglePanel("highlight");
              }}
              title="Highlight · pick a color · 2"
            >
              <Highlighter className="h-4 w-4" />
            </ToolBtn>
            <AnimatePresence>
              {openPanel === "highlight" && (
                <Popover isMobile>
                  <p className="mb-2 text-[11px] font-semibold text-foreground/80">
                    Highlight color
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

          <div className="relative">
            <ToolBtn
              active={annotationMode === "pen"}
              panelOpen={openPanel === "pen"}
              pip={penColor}
              onClick={() => {
                setAnnotationMode("pen");
                togglePanel("pen");
              }}
              title="Draw · pick color and width · 3"
            >
              <PenTool className="h-4 w-4" />
            </ToolBtn>
            <AnimatePresence>
              {openPanel === "pen" && (
                <Popover isMobile wide>
                  <p className="mb-2 text-[11px] font-semibold text-foreground/80">
                    Pen color
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
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
                  <div className="border-t border-border pt-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-foreground/80">
                        Thickness
                      </p>
                      <span className="font-mono text-[11px] tabular-nums text-foreground/60">
                        {penWidth}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={penWidth}
                      onChange={(e) => setPenWidth(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted/70 accent-[var(--brand)]"
                    />
                  </div>
                </Popover>
              )}
            </AnimatePresence>
          </div>

          <ToolBtn
            active={annotationMode === "eraser"}
            onClick={() => {
              setAnnotationMode("eraser");
              setOpenPanel(null);
            }}
            title="Eraser · 4"
          >
            <Eraser className="h-4 w-4" />
          </ToolBtn>

          <ToolBtn
            active={annotationMode === "note"}
            onClick={() => {
              setAnnotationMode("note");
              setOpenPanel(null);
            }}
            title="Sticky note · 5"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </ToolBtn>

          <div className="mx-0.5 h-6 w-px bg-border/40" />
          <HistoryBtn onClick={undo} disabled={undoStack.length === 0} title="Undo · Ctrl+Z" label="Undo">
            <Undo2 className="h-4 w-4" />
          </HistoryBtn>
          <HistoryBtn onClick={redo} disabled={redoStack.length === 0} title="Redo · Ctrl+Shift+Z" label="Redo">
            <Redo2 className="h-4 w-4" />
          </HistoryBtn>
          <div className="mx-0.5 h-6 w-px bg-border/30" />
          <ClearBtn onClick={onClearAll} />
        </div>
      ) : (
        /* ── DESKTOP: need to choose rail or collapsed handle ───────────── */
        <AnimatePresence>
          {!isMinimized ? (
            <motion.div
              key="desktop-rail"
              initial={{ opacity: 0, x: -10, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.96 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute left-3 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1 rounded-2xl border border-border/40 bg-background/90 px-1.5 py-2 shadow-lg backdrop-blur-xl"
            >
              <ToolBtn
                active={annotationMode === "select"}
                onClick={() => {
                  setAnnotationMode("select");
                  setOpenPanel(null);
                }}
                title="Select · 1"
              >
                <MousePointer className="h-4 w-4" />
              </ToolBtn>

              <div className="relative">
                <ToolBtn
                  active={annotationMode === "highlight"}
                  panelOpen={openPanel === "highlight"}
                  pip={highlightColor}
                  onClick={() => {
                    setAnnotationMode("highlight");
                    togglePanel("highlight");
                  }}
                  title="Highlight · pick a color · 2"
                >
                  <Highlighter className="h-4 w-4" />
                </ToolBtn>
                <AnimatePresence>
                  {openPanel === "highlight" && (
                    <Popover>
                      <p className="mb-2 text-[11px] font-semibold text-foreground/80">
                        Highlight color
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

              <div className="relative">
                <ToolBtn
                  active={annotationMode === "pen"}
                  panelOpen={openPanel === "pen"}
                  pip={penColor}
                  onClick={() => {
                    setAnnotationMode("pen");
                    togglePanel("pen");
                  }}
                  title="Draw · pick color and width · 3"
                >
                  <PenTool className="h-4 w-4" />
                </ToolBtn>
                <AnimatePresence>
                  {openPanel === "pen" && (
                    <Popover wide>
                      <p className="mb-2 text-[11px] font-semibold text-foreground/80">
                        Pen color
                      </p>
                      <div className="mb-3 flex flex-wrap gap-2">
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
                      <div className="border-t border-border pt-2.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-foreground/80">
                            Thickness
                          </p>
                          <span className="font-mono text-[11px] tabular-nums text-foreground/60">
                            {penWidth}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={12}
                          value={penWidth}
                          onChange={(e) => setPenWidth(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted/70 accent-[var(--brand)]"
                        />
                      </div>
                    </Popover>
                  )}
                </AnimatePresence>
              </div>

              <ToolBtn
                active={annotationMode === "eraser"}
                onClick={() => {
                  setAnnotationMode("eraser");
                  setOpenPanel(null);
                }}
                title="Eraser · 4"
              >
                <Eraser className="h-4 w-4" />
              </ToolBtn>

              <ToolBtn
                active={annotationMode === "note"}
                onClick={() => {
                  setAnnotationMode("note");
                  setOpenPanel(null);
                }}
                title="Sticky note · 5"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </ToolBtn>

              <div className="my-0.5 h-px w-6 border-t border-border/40" />
              <HistoryBtn onClick={undo} disabled={undoStack.length === 0} title="Undo · Ctrl+Z" label="Undo">
                <Undo2 className="h-4 w-4" />
              </HistoryBtn>
              <HistoryBtn onClick={redo} disabled={redoStack.length === 0} title="Redo · Ctrl+Shift+Z" label="Redo">
                <Redo2 className="h-4 w-4" />
              </HistoryBtn>
              <div className="my-0.5 h-px w-6 border-t border-border/30" />
              <ClearBtn onClick={onClearAll} />

              <div className="mt-0.5 h-px w-6 border-t border-border/30" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Hide toolbar"
                title="Hide toolbar"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsMinimized(true);
                  setOpenPanel(null);
                }}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          ) : (
            <motion.button
              key="desktop-collapsed"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              aria-label="Show toolbar"
              title="Show toolbar"
              onClick={() => {
                setIsMinimized(false);
                setOpenPanel(null);
              }}
              className="absolute left-3 top-1/2 z-40 -translate-y-1/2 flex h-24 w-8 items-center justify-center rounded-2xl border border-border/40 bg-background/90 shadow-lg backdrop-blur-xl transition-colors hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ─── Shared sub-components ─────────────────────────────────────────── */

function ToolBtn({
  active,
  panelOpen,
  pip,
  onClick,
  title,
  children,
}: {
  active: boolean;
  panelOpen?: boolean;
  pip?: string;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      aria-label={title.split(" · ")[0]}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90
        ${
          active
            ? "bg-brand text-brand-fg shadow-sm"
            : panelOpen
              ? "bg-muted/70 text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
    >
      {children}
      {pip && (
        <span
          aria-hidden
          className="absolute bottom-[3px] left-1/2 h-[3px] w-3 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: active ? "rgba(255,255,255,0.9)" : pip }}
        />
      )}
    </button>
  );
}

function HistoryBtn({
  onClick,
  disabled,
  title,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}

function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Clear all marks on this page"
      aria-label="Clear all marks on this page"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-400 transition-all hover:bg-red-50 hover:text-red-500 active:scale-90 dark:hover:bg-red-950/20"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function Popover({
  children,
  wide,
  isMobile,
}: {
  children: React.ReactNode;
  wide?: boolean;
  isMobile?: boolean;
}) {
  return (
    <motion.div
      initial={isMobile ? { opacity: 0, y: 8, scale: 0.96 } : { opacity: 0, x: -6, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={isMobile ? { opacity: 0, y: 8, scale: 0.96 } : { opacity: 0, x: -6, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      className={
        isMobile
          ? `absolute bottom-full left-1/2 mb-2 z-50 -translate-x-1/2 rounded-xl border border-border/40 bg-background/95 p-3 shadow-lg backdrop-blur-lg ${wide ? "w-48" : "w-auto"}`
          : `absolute left-[calc(100%+10px)] top-0 z-50 rounded-xl border border-border/40 bg-background/95 p-3 shadow-lg backdrop-blur-lg ${wide ? "w-48" : "w-auto"}`
      }
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
      aria-label={label}
      aria-pressed={active}
      className={`h-5 w-5 rounded-md border transition-all hover:scale-110 active:scale-95
        ${tailwind}
        ${active ? "ring-2 ring-brand ring-offset-2" : "border-black/5 dark:border-white/10"}`}
    />
  );
}