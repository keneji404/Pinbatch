document.addEventListener("DOMContentLoaded", function () {
    const status = document.getElementById("status");
    const downloadBtn = document.getElementById("download");
    const notes = document.getElementById("notes");

    function scanImages() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs[0].url.includes("pinterest.")) {
                status.textContent = "This extension only works on Pinterest.";
                return;
            }

            chrome.tabs.executeScript({
                code: `
                    new Promise(resolve => {
                        if (document.readyState === "complete") {
                            resolve();
                        } else {
                            window.addEventListener("load", resolve);
                        }
                    }).then(() => {
                        if (window.location.pathname.split('/').filter(Boolean).length !== 2) {
                            return { error: "Go to your Profile and pick a Board to start." };
                        }

                        let boardName = document.querySelector('h1')?.innerText || "Pinterest";
                        let images = Array.from(document.querySelectorAll('.masonryContainer img')).map(img => {
                            let src = img.src;
                            if (src.includes("236x")) {
                                let originalsURL = src.replace("236x", "originals");
                                let fallbackURL = src.replace("236x", "736x");

                                return new Promise(resolve => {
                                    let testImage = new Image();
                                    testImage.src = originalsURL;
                                    testImage.onload = () => resolve(originalsURL);
                                    testImage.onerror = () => {
                                        let fallbackImage = new Image();
                                        fallbackImage.src = fallbackURL;
                                        fallbackImage.onload = () => resolve(fallbackURL);
                                        fallbackImage.onerror = () => resolve(src);
                                    };
                                });
                            } else {
                                return Promise.resolve(src);
                            }
                        });

                        return Promise.all(images).then(finalImages => {
                            return { boardName, images: finalImages };
                        });
                    });
                `
            }, function (results) {
                if (results && results[0]) {
                    if (results[0].error) {
                        status.textContent = results[0].error;
                        return;
                    }

                    let { boardName, images } = results[0];
                    status.textContent = `Found ${images.length} pins in '${boardName}'`;
                    downloadBtn.style.display = "block";
                    notes.style.display = "block";

                    downloadBtn.addEventListener("click", function () {
                        multiThreadedDownload(images, boardName, 5); // Download 5 at a time
                    });
                } else {
                    status.textContent = "No pins found.";
                }
            });
        });
    }

    function multiThreadedDownload(urls, folderName, batchSize) {
        let index = 0;
        let count = 0;

        function downloadNextBatch() {
            let batch = urls.slice(index, index + batchSize);
            if (batch.length === 0) return;

            let promises = batch.map((url, i) => {
                return new Promise(resolve => {
                    let filename = `${folderName}/pin_${index + i + 1}.${url.split(".").pop().split("?")[0]}`;
                    chrome.downloads.download({ url, filename }, function () {
                        count++;
                        status.textContent = `Downloading ${count} of ${urls.length} pins`;
                        resolve();
                    });
                });
            });

            Promise.all(promises).then(() => {
                index += batchSize;
                if (index < urls.length) {
                    downloadNextBatch();
                } else {
                    status.textContent = "Download complete!";
                }
            });
        }

        downloadNextBatch();
    }

    scanImages();
});
