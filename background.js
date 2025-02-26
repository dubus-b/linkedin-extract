chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension LinkedIn to CSV installée !");
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "setZoom") {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length > 0) {
                chrome.tabs.setZoom(tabs[0].id, message.zoom, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Erreur de zoom :", chrome.runtime.lastError.message);
                    } else {
                        console.log(`Zoom ajusté à ${message.zoom * 100}%`);
                    }
                });
            }
        });
    }
});
