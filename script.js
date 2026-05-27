/**
 * FloraStream - Custom Flower-Themed Video Player
 * Vanilla JavaScript implementation for controls and link resolution.
 */

// 1. Shared Video Database (Configured with Google Drive View URLs)
const videoPlaylist = [
    {
        id: "aiswarya",
        src: "https://drive.google.com/file/d/1BB6dMr7yeSOxXc2s_dysjvIS5ZCEZgpl/view?usp=drive_link"
    },
    {
        id: "arya",
        src: "https://drive.google.com/file/d/1SPHg0NrYzjGSfkC2DJ4tf0Do7_QIfxD2/view?usp=drive_link"
    },
    {
        id: "group",
        src: "https://drive.google.com/file/d/1HvhwrMLOJNLWFAEvp4OUm8ak6M1KdaVt/view?usp=drive_link"
    }
];

// Helper to convert standard Google Drive web sharing URLs to direct file streaming links
function getGoogleDriveStreamUrl(url) {
    if (!url) return "";
    if (url.includes("drive.google.com/uc?")) return url;
    
    // Matches the file ID from "/file/d/FILE_ID/view" format
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return url;
}

// Helper to construct a clean sharing view URL from input links
function getGoogleDriveViewUrl(url) {
    if (!url) return "";
    if (url.includes("/file/d/")) return url;
    
    // Matches the file ID from "id=FILE_ID" parameter
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/view?usp=sharing`;
    }
    return url;
}

// Helper to construct a direct browser-forced download link for mobile
function getGoogleDriveDownloadUrl(url) {
    if (!url) return "";
    let fileId = "";
    
    if (url.includes("id=")) {
        const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) fileId = match[1];
    } else {
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) fileId = match[1];
    }
    
    if (fileId) {
        // drive.usercontent.google.com bypasses mobile OS app intent captures,
        // forcing the file to open inside Safari/Chrome so the download functions correctly.
        return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    }
    return url;
}

// Current Active State
let currentVideoIndex = 0;
let isScrubbing = false;

// 2. DOM Elements Selection & Setup
document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Video Elements
    const videoContainer = document.getElementById("videoContainer");
    const video = document.getElementById("videoElement");
    
    // Play/Pause overlays and controls
    const playBtn = document.getElementById("playBtn");
    const largePlayOverlay = document.getElementById("largePlayOverlay");
    const largePlayBtn = largePlayOverlay.querySelector(".large-play-btn");
    
    // Volume controls
    const muteBtn = document.getElementById("muteBtn");
    const volumeSlider = document.getElementById("volumeSlider");
    
    // Progress / Timeline controls
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const bufferedBar = document.getElementById("bufferedBar");
    const progressHandle = document.getElementById("progressHandle");
    const progressTooltip = document.getElementById("progressTooltip");
    
    // Time controls
    const timeCurrent = document.getElementById("timeCurrent");
    const timeDuration = document.getElementById("timeDuration");
    
    // Speed Controls
    const speedBtn = document.getElementById("speedBtn");
    const speedMenu = document.getElementById("speedMenu");
    
    // Fullscreen
    const fullscreenBtn = document.getElementById("fullscreenBtn");
    
    // Status Overlays
    const loaderOverlay = document.getElementById("loaderOverlay");
    const bufferingIndicator = document.getElementById("bufferingIndicator");
    const errorOverlay = document.getElementById("errorOverlay");
    const errorFallbackLink = document.getElementById("errorFallbackLink");
    
    // Selector Buttons
    const selectorButtons = document.querySelectorAll(".dance-selector-btn");
    
    // Action elements
    const driveBtn = document.getElementById("driveBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const toastContainer = document.getElementById("toastContainer");

    // ==========================================
    // Video Switcher & Details Config
    // ==========================================
    
    function loadVideoDetails(item) {
        // Set dynamic URL targets
        const viewUrl = getGoogleDriveViewUrl(item.src);
        
        driveBtn.href = viewUrl;
        downloadBtn.href = getGoogleDriveDownloadUrl(item.src);
        errorFallbackLink.href = viewUrl;
        
        // Sync the active class across the selector buttons
        selectorButtons.forEach(btn => {
            if (btn.getAttribute("data-id") === item.id) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    function switchVideo(index) {
        if (index < 0 || index >= videoPlaylist.length) return;
        
        currentVideoIndex = index;
        const targetVideo = videoPlaylist[currentVideoIndex];
        
        // Show loading spinner
        loaderOverlay.classList.remove("hidden");
        errorOverlay.classList.add("hidden");
        bufferingIndicator.classList.add("hidden");

        // Load new source (Autoplay is standard on load)
        video.src = getGoogleDriveStreamUrl(targetVideo.src);
        video.load();
        
        // Match browser's autoplay muted policies
        video.muted = true;
        updateVolumeUI();
        
        // Play the video stream
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                updatePlayStateUI(true);
            }).catch(error => {
                console.log("Autoplay was blocked or interrupted: ", error);
                updatePlayStateUI(false);
            });
        }
        
        loadVideoDetails(targetVideo);
    }

    // ==========================================
    // Media Control Functions
    // ==========================================
    
    // Play/Pause State Toggles
    function togglePlay() {
        if (video.paused || video.ended) {
            video.play().then(() => {
                updatePlayStateUI(true);
            }).catch(err => {
                showToast("Stream blocked by scanner. Click 'Go to Drive' or 'Download Video'.");
            });
        } else {
            video.pause();
            updatePlayStateUI(false);
        }
    }

    // Update play button styling
    function updatePlayStateUI(isPlaying) {
        const customPlayIcon = playBtn.querySelector(".control-icon-play");
        const customPauseIcon = playBtn.querySelector(".control-icon-pause");
        const largePlayIcon = largePlayOverlay.querySelector(".icon-play");
        const largePauseIcon = largePlayOverlay.querySelector(".icon-pause");

        if (isPlaying) {
            videoContainer.classList.remove("paused");
            customPlayIcon.classList.add("hidden");
            customPauseIcon.classList.remove("hidden");
            largePlayIcon.classList.add("hidden");
            largePauseIcon.classList.remove("hidden");
            
            // Fade out the large play overlay on play
            largePlayBtn.style.transform = "scale(0.8)";
            largePlayBtn.style.opacity = "0";
        } else {
            videoContainer.classList.add("paused");
            customPlayIcon.classList.remove("hidden");
            customPauseIcon.classList.add("hidden");
            largePlayIcon.classList.remove("hidden");
            largePauseIcon.classList.add("hidden");
            
            // Bring back full opacity on pause
            largePlayBtn.style.transform = "scale(1)";
            largePlayBtn.style.opacity = "1";
        }
    }

    // Volume Adjustment
    function toggleMute() {
        video.muted = !video.muted;
        if (!video.muted && video.volume === 0) {
            video.volume = 0.5;
        }
        updateVolumeUI();
    }

    function updateVolumeUI() {
        const volumeIcon = muteBtn.querySelector(".volume-icon");
        const muteIcon = muteBtn.querySelector(".mute-icon");

        if (video.muted || video.volume === 0) {
            volumeIcon.classList.add("hidden");
            muteIcon.classList.remove("hidden");
            volumeSlider.value = 0;
        } else {
            volumeIcon.classList.remove("hidden");
            muteIcon.classList.add("hidden");
            volumeSlider.value = video.volume;
        }
    }

    // Fullscreen Toggle
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (videoContainer.requestFullscreen) {
                videoContainer.requestFullscreen();
            } else if (videoContainer.webkitRequestFullscreen) { /* Safari */
                videoContainer.webkitRequestFullscreen();
            } else if (videoContainer.msRequestFullscreen) { /* IE11 */
                videoContainer.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    // Watch fullscreen change to update icon states
    function onFullscreenChange() {
        const enterIcon = fullscreenBtn.querySelector(".fs-enter-icon");
        const exitIcon = fullscreenBtn.querySelector(".fs-exit-icon");

        if (document.fullscreenElement === videoContainer) {
            videoContainer.classList.add("fullscreen");
            enterIcon.classList.add("hidden");
            exitIcon.classList.remove("hidden");
        } else {
            videoContainer.classList.remove("fullscreen");
            enterIcon.classList.remove("hidden");
            exitIcon.classList.add("hidden");
        }
    }

    // Time Format conversion (seconds to MM:SS)
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    }

    // Track Time and Timeline Buffer updates
    function updateTimeline() {
        if (isScrubbing) return;
        
        if (video.duration) {
            const percentage = (video.currentTime / video.duration) * 100;
            progressBar.style.width = `${percentage}%`;
            progressHandle.style.left = `${percentage}%`;
            timeCurrent.textContent = formatTime(video.currentTime);
        }
    }

    function updateBuffer() {
        if (video.duration && video.buffered.length > 0) {
            let currentBufferedEnd = 0;
            for (let i = 0; i < video.buffered.length; i++) {
                if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
                    currentBufferedEnd = video.buffered.end(i);
                    break;
                }
            }
            const percentage = (currentBufferedEnd / video.duration) * 100;
            bufferedBar.style.width = `${percentage}%`;
        }
    }

    // Drag-to-Scrub timeline controller
    function handleScrub(e) {
        const rect = progressContainer.getBoundingClientRect();
        let posX = (e.clientX - rect.left) / rect.width;
        if (posX < 0) posX = 0;
        if (posX > 1) posX = 1;

        progressBar.style.width = `${posX * 100}%`;
        progressHandle.style.left = `${posX * 100}%`;
        
        const targetTime = posX * video.duration;
        timeCurrent.textContent = formatTime(targetTime);
        return targetTime;
    }

    // Progress Bar Hover Tooltip Tracker
    function handleProgressBarTooltip(e) {
        const rect = progressContainer.getBoundingClientRect();
        let posX = (e.clientX - rect.left) / rect.width;
        if (posX < 0) posX = 0;
        if (posX > 1) posX = 1;
        
        const targetTime = posX * video.duration;
        progressTooltip.textContent = formatTime(targetTime);
        progressTooltip.style.left = `${posX * 100}%`;
    }

    // Playback Speed adjustments
    function setSpeed(rate) {
        video.playbackRate = rate;
        speedBtn.textContent = rate === 1 ? "1.0x" : `${rate}x`;
        
        speedMenu.querySelectorAll("li").forEach(li => {
            if (parseFloat(li.getAttribute("data-speed")) === rate) {
                li.classList.add("active");
            } else {
                li.classList.remove("active");
            }
        });
        speedMenu.classList.add("hidden");
    }

    // Muted autoplay handler on load
    function handleAutoplayMuted() {
        video.muted = true;
        updateVolumeUI();
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                updatePlayStateUI(true);
            }).catch(err => {
                console.log("Autoplay blocked or pending click.", err);
                updatePlayStateUI(false);
            });
        }
    }

    // ==========================================
    // Event Listeners Registration
    // ==========================================
    
    // Selector button triggers
    selectorButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const idx = videoPlaylist.findIndex(v => v.id === id);
            if (idx !== -1) {
                switchVideo(idx);
            }
        });
    });

    // Play Click Bindings
    playBtn.addEventListener("click", togglePlay);
    largePlayOverlay.addEventListener("click", togglePlay);
    
    // Volume Slider & Mute
    muteBtn.addEventListener("click", toggleMute);
    volumeSlider.addEventListener("input", (e) => {
        video.volume = e.target.value;
        video.muted = (video.volume === 0);
        updateVolumeUI();
    });

    // Fullscreen Event hooks
    fullscreenBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("msfullscreenchange", onFullscreenChange);

    // Timeline Scrub Binds
    progressContainer.addEventListener("mousedown", (e) => {
        isScrubbing = true;
        const targetTime = handleScrub(e);
        
        function onMouseMove(moveEvent) {
            handleScrub(moveEvent);
        }
        
        function onMouseUp(upEvent) {
            isScrubbing = false;
            const finalTime = handleScrub(upEvent);
            if (!isNaN(finalTime)) {
                video.currentTime = finalTime;
            }
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }
        
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    });

    // Touch Support for mobile timeline scrub
    progressContainer.addEventListener("touchstart", (e) => {
        isScrubbing = true;
        const touch = e.touches[0];
        const rect = progressContainer.getBoundingClientRect();
        let posX = (touch.clientX - rect.left) / rect.width;
        if (posX < 0) posX = 0;
        if (posX > 1) posX = 1;
        
        function onTouchMove(moveEvent) {
            const moveTouch = moveEvent.touches[0];
            let movePosX = (moveTouch.clientX - rect.left) / rect.width;
            if (movePosX < 0) movePosX = 0;
            if (movePosX > 1) movePosX = 1;
            progressBar.style.width = `${movePosX * 100}%`;
            progressHandle.style.left = `${movePosX * 100}%`;
            timeCurrent.textContent = formatTime(movePosX * video.duration);
        }
        
        function onTouchEnd(endEvent) {
            isScrubbing = false;
            const ratio = parseFloat(progressBar.style.width) / 100;
            if (!isNaN(ratio) && video.duration) {
                video.currentTime = ratio * video.duration;
            }
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
        }
        
        window.addEventListener("touchmove", onTouchMove);
        window.addEventListener("touchend", onTouchEnd);
    });

    // Hover tooltip calculations
    progressContainer.addEventListener("mousemove", handleProgressBarTooltip);

    // Video State Listeners
    video.addEventListener("timeupdate", updateTimeline);
    video.addEventListener("progress", updateBuffer);
    
    video.addEventListener("loadedmetadata", () => {
        timeDuration.textContent = formatTime(video.duration);
        updateTimeline();
        updateBuffer();
    });

    // Loading & buffering overlay controls
    video.addEventListener("loadstart", () => {
        loaderOverlay.classList.remove("hidden");
        errorOverlay.classList.add("hidden");
        bufferingIndicator.classList.add("hidden");
    });

    video.addEventListener("canplay", () => {
        loaderOverlay.classList.add("hidden");
    });

    video.addEventListener("waiting", () => {
        if (loaderOverlay.classList.contains("hidden")) {
            bufferingIndicator.classList.remove("hidden");
        }
    });

    video.addEventListener("playing", () => {
        loaderOverlay.classList.add("hidden");
        bufferingIndicator.classList.add("hidden");
        updatePlayStateUI(true);
    });

    video.addEventListener("seeked", () => {
        bufferingIndicator.classList.add("hidden");
    });

    // Error triggers
    video.addEventListener("error", (e) => {
        console.error("Direct stream loading error:", e);
        loaderOverlay.classList.add("hidden");
        bufferingIndicator.classList.add("hidden");
        errorOverlay.classList.remove("hidden");
        updatePlayStateUI(false);
    });

    // Speed Controls dropdown
    speedBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        speedMenu.classList.toggle("hidden");
    });

    window.addEventListener("click", () => {
        speedMenu.classList.add("hidden");
    });

    speedMenu.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", (e) => {
            const speed = parseFloat(e.target.getAttribute("data-speed"));
            setSpeed(speed);
        });
    });

    // Check URL search parameters to load requested video on link open
    function loadUrlParamVideo() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoParam = urlParams.get("video");
        
        if (videoParam) {
            const videoIdx = videoPlaylist.findIndex(v => v.id === videoParam);
            if (videoIdx !== -1) {
                currentVideoIndex = videoIdx;
            }
        }
    }

    // Dynamic toast alerts helper
    function showToast(message) {
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `
            <i data-lucide="info" class="toast-icon"></i>
            <span>${message}</span>
        `;
        toastContainer.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Keyboard Shortcuts handler
    window.addEventListener("keydown", (e) => {
        const activeEl = document.activeElement;
        if (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") return;
        
        switch (e.code) {
            case "Space":
                e.preventDefault();
                togglePlay();
                break;
            case "KeyM":
                e.preventDefault();
                toggleMute();
                break;
            case "KeyF":
                e.preventDefault();
                toggleFullscreen();
                break;
            case "ArrowRight":
                e.preventDefault();
                video.currentTime = Math.min(video.duration, video.currentTime + 5);
                showToast("Skipped forward 5s");
                break;
            case "ArrowLeft":
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 5);
                showToast("Rewind 5s");
                break;
            case "ArrowUp":
                e.preventDefault();
                video.volume = Math.min(1, video.volume + 0.1);
                video.muted = false;
                updateVolumeUI();
                showToast(`Volume ${Math.round(video.volume * 100)}%`);
                break;
            case "ArrowDown":
                e.preventDefault();
                video.volume = Math.max(0, video.volume - 0.1);
                video.muted = (video.volume === 0);
                updateVolumeUI();
                showToast(`Volume ${Math.round(video.volume * 100)}%`);
                break;
        }
    });

    // ==========================================
    // Initialization Execution
    // ==========================================
    loadUrlParamVideo();
    video.src = getGoogleDriveStreamUrl(videoPlaylist[currentVideoIndex].src);
    loadVideoDetails(videoPlaylist[currentVideoIndex]);
    handleAutoplayMuted();
});
