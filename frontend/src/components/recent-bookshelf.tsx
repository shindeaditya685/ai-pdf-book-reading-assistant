"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, Camera, Search, BookOpen, Library, Sparkles } from "lucide-react";
import { authFetch } from "@/lib/api";

interface RecentBook {
  fileName: string;
  pageCount: number;
  lastPage: number;
  coverImage: string | null;
}

/* ── rich colour palettes for book spines ── */
const SPINE_COLORS = [
  "#1a2f38", // deep teal
  "#2d1b2e", // plum noir
  "#1e2a3a", // midnight navy
  "#2a2520", // espresso
  "#1f2d23", // forest shadow
  "#2c2233", // royal violet
  "#312520", // dark sienna
  "#1b2626", // dark slate
];

const SPINE_ACCENTS = [
  "#2a5a6a", // ocean accent
  "#5a3060", // mauve glow
  "#3a4e70", // steel blue
  "#5a4a30", // amber gold
  "#3a5a3a", // emerald
  "#5a3a6a", // iris purple
  "#6a3a2a", // russet
  "#3a5050", // sage
];

const SPINE_HIGHLIGHTS = [
  "#4ad0d0", // teal neon
  "#d06aaa", // pink glow
  "#6a8ad0", // periwinkle
  "#d0aa4a", // gold
  "#6ad06a", // lime
  "#aa6ad0", // lavender
  "#d07a4a", // tangerine
  "#6ad0aa", // mint
];

function hashColorIndex(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % SPINE_COLORS.length;
}

function titleOf(fileName: string) {
  return (fileName.split("/").pop() || fileName).replace(/\.pdf$/i, "");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

type RecentBookshelfProps = {
  onOpen: (fileName: string) => void;
  loadingFileName?: string | null;
};

/* ── inline CSS for 3D book effects & animations ── */
const shelfStyles = `
  @keyframes bookshelf-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes float-up {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
  }
  .bookshelf-card {
    perspective: 800px;
    transform-style: preserve-3d;
  }
  .bookshelf-card .book-inner {
    transition: transform 0.5s cubic-bezier(0.23,1,0.32,1), box-shadow 0.5s cubic-bezier(0.23,1,0.32,1);
    transform-origin: center bottom;
  }
  .bookshelf-card:hover .book-inner {
    transform: translateY(-12px) rotateX(2deg) scale(1.02);
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 30px -10px var(--book-glow, rgba(74,208,208,0.15));
  }
  .bookshelf-card .book-overlay {
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  .bookshelf-card:hover .book-overlay {
    opacity: 1;
  }
  .bookshelf-card .cover-btn {
    opacity: 0;
    transition: opacity 0.3s ease 0.1s;
  }
  .bookshelf-card:hover .cover-btn {
    opacity: 1;
  }
  .book-progress-ring {
    transition: stroke-dashoffset 0.8s cubic-bezier(0.23,1,0.32,1);
  }
  .shelf-plank {
    position: relative;
  }
  .shelf-plank::before {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: -8px;
    height: 8px;
    background: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%);
    pointer-events: none;
  }
  .search-glow:focus-within {
    box-shadow: 0 0 0 2px rgba(74,208,208,0.2), 0 0 20px -5px rgba(74,208,208,0.1);
  }
`;

/* ── Progress Ring SVG component ── */
function ProgressRing({ progress, size = 32, stroke = 2.5, color }: { progress: number; size?: number; stroke?: number; color: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="book-progress-ring -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RecentBookshelf({
  onOpen,
  loadingFileName,
}: RecentBookshelfProps) {
  const [books, setBooks] = useState<RecentBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploadingCover, setUploadingCover] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch("/api/library");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setBooks(data.books || []);
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCoverClick = (fileName: string) => {
    coverTargetRef.current = fileName;
    coverInputRef.current?.click();
  };

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = coverTargetRef.current;
    if (!file || !target) return;

    setUploadingCover(target);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await authFetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: target, coverImage: dataUrl }),
      });

      if (res.ok) {
        setBooks((prev) =>
          prev.map((b) =>
            b.fileName === target ? { ...b, coverImage: dataUrl } : b,
          ),
        );
      }
    } catch {
      /* ignore */
    }
    setUploadingCover(null);
    coverTargetRef.current = null;
    if (e.target) e.target.value = "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
            <div className="absolute inset-0 h-8 w-8 animate-spin rounded-full border-2 border-transparent border-b-teal-400/30" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="text-xs text-white/40 tracking-wider uppercase">Loading library…</p>
        </div>
      </div>
    );
  }

  if (books.length === 0) return null;

  const filtered = search.trim()
    ? books.filter((b) =>
        titleOf(b.fileName).toLowerCase().includes(search.toLowerCase().trim()),
      )
    : books;

  const rows = chunk(filtered, 4);

  return (
    <>
      <style>{shelfStyles}</style>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #141210 0%, #1a1714 40%, #0f0e0c 100%)",
          boxShadow: "0 4px 30px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center h-9 w-9 rounded-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(74,208,208,0.15) 0%, rgba(74,208,208,0.05) 100%)",
                  border: "1px solid rgba(74,208,208,0.15)",
                }}
              >
                <Library className="h-4 w-4 text-teal-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90 tracking-wide">
                  Your Library
                </h3>
                <p className="text-[11px] text-white/35 mt-0.5">
                  {books.length} {books.length === 1 ? "volume" : "volumes"} · {books.filter(b => b.lastPage > 0).length} in progress
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider font-medium"
                style={{
                  background: "rgba(74,208,208,0.08)",
                  color: "rgba(74,208,208,0.7)",
                  border: "1px solid rgba(74,208,208,0.1)",
                }}
              >
                <Sparkles className="h-3 w-3" />
                {books.filter(b => {
                  const p = b.pageCount > 0 ? Math.round((b.lastPage / b.pageCount) * 100) : 0;
                  return p >= 100;
                }).length} completed
              </div>
            </div>
          </div>

          {/* ── Search Bar ── */}
          <div
            className="search-glow flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Search className="h-3.5 w-3.5 text-white/25 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your library..."
              className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5 rounded transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Books Grid ── */}
        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-8 w-8 mx-auto mb-3 text-white/15" />
              <p className="text-sm text-white/35 italic">
                {search ? `No volumes match "${search}".` : "Your library is empty."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="relative">
                  {/* Book Row */}
                  <div
                    className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 pb-2"
                  >
                    {row.map((book) => {
                      const title = titleOf(book.fileName);
                      const progress =
                        book.pageCount > 0
                          ? Math.min(
                              100,
                              Math.round((book.lastPage / book.pageCount) * 100),
                            )
                          : 0;
                      const colorIdx = hashColorIndex(book.fileName);
                      const spineColor = SPINE_COLORS[colorIdx];
                      const accentColor = SPINE_ACCENTS[colorIdx];
                      const highlightColor = SPINE_HIGHLIGHTS[colorIdx];

                      return (
                        <div
                          key={book.fileName}
                          className="bookshelf-card cursor-pointer"
                          style={{ ["--book-glow" as string]: `${highlightColor}30` }}
                          onClick={() => onOpen(book.fileName)}
                        >
                          <div
                            className="book-inner relative aspect-[3/4.2] overflow-hidden rounded-lg"
                            style={{
                              backgroundColor: spineColor,
                              boxShadow: `0 8px 25px -10px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)`,
                            }}
                          >
                            {/* ── Book Cover ── */}
                            {book.coverImage ? (
                              <>
                                <img
                                  src={book.coverImage}
                                  alt={`Cover of ${title}`}
                                  loading="lazy"
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                                {/* subtle vignette on cover images */}
                                <div
                                  className="absolute inset-0 pointer-events-none"
                                  style={{
                                    background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.5) 100%)",
                                  }}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCoverClick(book.fileName);
                                  }}
                                  className="cover-btn absolute right-2 top-2 z-20 flex size-7 items-center justify-center rounded-full text-white/80 backdrop-blur-sm transition-all hover:scale-110"
                                  style={{ background: "rgba(0,0,0,0.4)" }}
                                >
                                  <Camera className="h-3 w-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* ── Generated Cover Pattern ── */}
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    background: `
                                      linear-gradient(135deg, ${spineColor} 0%, ${accentColor} 60%, ${spineColor} 100%)
                                    `,
                                  }}
                                />
                                {/* Decorative line pattern */}
                                <div
                                  className="absolute inset-0 opacity-[0.04]"
                                  style={{
                                    backgroundImage: `repeating-linear-gradient(
                                      0deg,
                                      transparent,
                                      transparent 8px,
                                      rgba(255,255,255,0.5) 8px,
                                      rgba(255,255,255,0.5) 9px
                                    )`,
                                  }}
                                />
                                {/* Top accent bar */}
                                <div
                                  className="absolute top-0 left-0 right-0 h-1"
                                  style={{ background: highlightColor, opacity: 0.6 }}
                                />
                                {/* Centered title block */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                                  <div
                                    className="mb-2 w-8 h-[1px]"
                                    style={{ background: `${highlightColor}50` }}
                                  />
                                  <div className="text-[11px] font-bold leading-tight text-white/90 line-clamp-3 mb-1">
                                    {title}
                                  </div>
                                  <div
                                    className="mt-1 w-8 h-[1px]"
                                    style={{ background: `${highlightColor}50` }}
                                  />
                                  <div className="text-[9px] text-white/40 mt-2 tracking-wider uppercase">
                                    {book.pageCount} pages
                                  </div>
                                </div>
                                {/* Add cover overlay button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCoverClick(book.fileName);
                                  }}
                                  className="cover-btn absolute inset-0 z-20 flex items-center justify-center transition-all"
                                  style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
                                >
                                  <div className="flex flex-col items-center gap-1.5">
                                    {uploadingCover === book.fileName ? (
                                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                                    ) : (
                                      <>
                                        <div
                                          className="flex items-center justify-center h-8 w-8 rounded-full"
                                          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                                        >
                                          <Camera className="h-3.5 w-3.5 text-white/80" />
                                        </div>
                                        <span className="text-[9px] uppercase tracking-widest text-white/60 font-medium">
                                          Add Cover
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </button>
                              </>
                            )}

                            {/* ── Spine edge effects ── */}
                            <div
                              className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
                              style={{
                                background: `linear-gradient(180deg, ${highlightColor}30 0%, rgba(255,255,255,0.08) 50%, transparent 100%)`,
                              }}
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-[1px] bg-black/30" />

                            {/* ── Progress Ring (top-left) ── */}
                            {progress > 0 && (
                              <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
                                <div className="relative flex items-center justify-center" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>
                                  <ProgressRing progress={progress} size={28} stroke={2} color={progress >= 100 ? "#34d399" : highlightColor} />
                                  <span className="absolute text-[7px] font-bold text-white/90">
                                    {progress >= 100 ? "✓" : `${progress}`}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* ── Bottom progress bar (subtle) ── */}
                            {progress > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/30">
                                <div
                                  className="h-full transition-all duration-700"
                                  style={{
                                    width: `${progress}%`,
                                    background: progress >= 100
                                      ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                                      : `linear-gradient(90deg, ${highlightColor}, ${highlightColor}80)`,
                                  }}
                                />
                              </div>
                            )}

                            {/* ── Loading overlay ── */}
                            {loadingFileName === book.fileName && (
                              <div
                                className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm"
                                style={{ backgroundColor: "rgba(10,10,10,0.85)" }}
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
                                  <span className="text-[9px] text-white/50 uppercase tracking-wider">Opening…</span>
                                </div>
                              </div>
                            )}

                            {/* ── Hover detail overlay ── */}
                            <div
                              className="book-overlay absolute inset-0 flex flex-col p-3 text-center"
                              style={{
                                background: "linear-gradient(180deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.95) 100%)",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden gap-1.5">
                                <div className="text-[11px] leading-tight text-white/90 font-medium line-clamp-3">
                                  {title}
                                </div>
                                <div className="text-[9px] text-white/40 leading-tight">
                                  {book.lastPage > 0
                                    ? `Page ${book.lastPage} of ${book.pageCount}`
                                    : `${book.pageCount} pages`}
                                  {progress > 0 && ` · ${progress}%`}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpen(book.fileName);
                                }}
                                className="mt-auto px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all hover:scale-105"
                                style={{
                                  background: `linear-gradient(135deg, ${highlightColor} 0%, ${accentColor} 100%)`,
                                  color: "white",
                                  boxShadow: `0 4px 12px -4px ${highlightColor}40`,
                                }}
                              >
                                {book.lastPage > 0 ? "Continue" : "Start Reading"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Wooden Shelf ── */}
                  <div className="shelf-plank -mt-1 relative">
                    {/* Top edge highlight */}
                    <div
                      className="h-[3px] w-full rounded-t-sm"
                      style={{
                        background: "linear-gradient(180deg, #d4a96a 0%, #c49a5c 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
                      }}
                    />
                    {/* Main plank */}
                    <div
                      className="relative h-[16px] w-full"
                      style={{
                        background: `
                          repeating-linear-gradient(90deg, 
                            rgba(180,130,70,0.1) 0px, 
                            transparent 2px, 
                            transparent 5px
                          ),
                          linear-gradient(180deg, #9a7040 0%, #7a5830 60%, #6a4828 100%)
                        `,
                        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.4)",
                      }}
                    >
                      {/* Random wood knot */}
                      <div
                        className="pointer-events-none absolute top-1/2 h-[6px] w-[14px] -translate-y-1/2 rounded-full opacity-30"
                        style={{
                          left: `${20 + ((rowIdx * 31) % 55)}%`,
                          background: "radial-gradient(ellipse, #3a2010 0%, transparent 70%)",
                        }}
                      />
                    </div>
                    {/* Bottom shadow */}
                    <div
                      className="h-[6px] w-full"
                      style={{
                        background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 100%)",
                      }}
                    />
                  </div>
                </div>
              ))}

              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverFile}
                className="hidden"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
