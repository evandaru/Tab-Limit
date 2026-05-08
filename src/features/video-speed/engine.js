/**
 * Video Speed Controller Engine
 * Mengontrol playback speed semua elemen video secara reaktif.
 */

export function applyVideoSpeedController() {
    // Prevent duplicate initialization
    if (window.__DEVKITA_VDS_ENGINE__) return;
    window.__DEVKITA_VDS_ENGINE__ = true;

    // -----------------------------
    // State
    // -----------------------------
    let playbackSpeed = 1.0;
    let fadeTimeout = null;
    let targetVideo = null;

    // -----------------------------
    // UI: Floating Badge
    // -----------------------------
    const badge = document.createElement("div");

    badge.id = "devkita-vds-indicator";

    Object.assign(badge.style, {
        position: "fixed",
        background: "rgba(15, 23, 42, 0.85)",
        color: "#f8fafc",
        fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "13px",
        fontWeight: "600",
        padding: "6px 12px",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.1)",
        zIndex: "2147483647",
        pointerEvents: "none",
        transition: "opacity 0.2s cubic-bezier(0.4,0,0.2,1)",
        opacity: "0",
        backdropFilter: "blur(4px)",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    });

    document.documentElement.appendChild(badge);

    // -----------------------------
    // Helpers
    // -----------------------------

    const getAllVideos = () => {
        return document.querySelectorAll("video");
    };

    const syncPlaybackRates = () => {
        getAllVideos().forEach((video) => {
            if (video.playbackRate !== playbackSpeed) {
                video.playbackRate = playbackSpeed;
            }
        });
    };

    const showBadge = (videoNode) => {
        if (!videoNode || !document.contains(videoNode)) return;

        const rect = videoNode.getBoundingClientRect();

        // Skip if outside viewport
        const isOutsideViewport =
            rect.bottom < 0 ||
            rect.top > window.innerHeight ||
            rect.right < 0 ||
            rect.left > window.innerWidth;

        if (isOutsideViewport) return;

        badge.textContent = `${playbackSpeed.toFixed(2)}x`;

        badge.style.top = `${Math.max(10, rect.top + 16)}px`;
        badge.style.left = `${Math.max(10, rect.left + 16)}px`;
        badge.style.opacity = "1";

        clearTimeout(fadeTimeout);

        fadeTimeout = setTimeout(() => {
            badge.style.opacity = "0";
        }, 1500);
    };

    const updateSpeed = (delta) => {
        playbackSpeed = Math.min(
            16,
            Math.max(0.25, playbackSpeed + delta)
        );

        syncPlaybackRates();

        const activeVideo =
            targetVideo || document.querySelector("video");

        showBadge(activeVideo);
    };

    // -----------------------------
    // Keyboard Controls
    // -----------------------------
    const handleKeydown = (event) => {
        const target = event.target;

        const isEditable =
            target?.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);

        if (isEditable) return;

        const key = event.key.toLowerCase();

        switch (key) {
            case "d":
                updateSpeed(0.25);
                break;

            case "s":
                updateSpeed(-0.25);
                break;

            default:
                break;
        }
    };

    document.addEventListener("keydown", handleKeydown, {
        capture: true,
    });

    // -----------------------------
    // Mouse Hover Detection
    // -----------------------------
    const handleMouseMove = (event) => {
        const elements = document.elementsFromPoint(
            event.clientX,
            event.clientY
        );

        const hoveredVideo = elements.find(
            (el) => el.tagName === "VIDEO"
        );

        if (!hoveredVideo) return;

        targetVideo = hoveredVideo;

        // Force resync (YouTube suka reset playbackRate)
        if (hoveredVideo.playbackRate !== playbackSpeed) {
            hoveredVideo.playbackRate = playbackSpeed;
        }

        showBadge(hoveredVideo);
    };

    document.addEventListener("mousemove", handleMouseMove, {
        passive: true,
    });

    // -----------------------------
    // Mutation Observer
    // -----------------------------
    const domObserver = new MutationObserver((mutations) => {
        let shouldSync = false;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                if (
                    node.tagName === "VIDEO" ||
                    node.querySelector?.("video")
                ) {
                    shouldSync = true;
                    break;
                }
            }

            if (shouldSync) break;
        }

        if (shouldSync) {
            syncPlaybackRates();
        }
    });

    if (document.body) {
        domObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    // -----------------------------
    // Cleanup API
    // -----------------------------
    window.__DEVKITA_VDS_CLEANUP__ = () => {
        document.removeEventListener("keydown", handleKeydown, {
            capture: true,
        });

        document.removeEventListener("mousemove", handleMouseMove);

        domObserver.disconnect();

        clearTimeout(fadeTimeout);

        badge.remove();

        delete window.__DEVKITA_VDS_ENGINE__;
    };

    // Initial sync
    syncPlaybackRates();
}