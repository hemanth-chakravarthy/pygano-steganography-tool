// index.js - pygano Steganography Web Engine & UI Controller

// --- 1. BitQueue Implementation ---
class BitQueue {
    constructor(bytes = []) {
        this.buf = Array.from(bytes);
        this.l = 0;
        this.r = 8 * this.buf.length;
    }

    get length() {
        return this.r - this.l;
    }

    clear() {
        this.buf = [];
        this.l = 0;
        this.r = 0;
    }

    extend(bits, count) {
        for (let shift = count - 1; shift >= 0; shift--) {
            const byteIdx = Math.floor(this.r / 8);
            if (byteIdx >= this.buf.length) {
                this.buf.push(0);
            }
            const bit = (bits >> shift) & 1;
            this.buf[byteIdx] |= bit << (7 - (this.r % 8));
            this.r++;
        }
    }

    pop(count = 1) {
        if (this.r - this.l < count) {
            throw new Error("Not enough bits in the BitQueue");
        }
        let accumulator = 0;
        for (let i = 0; i < count; i++) {
            accumulator <<= 1;
            const byteIdx = Math.floor(this.l / 8);
            const bitIdx = 7 - (this.l % 8);
            accumulator |= (this.buf[byteIdx] >> bitIdx) & 1;
            this.l++;
        }
        return accumulator;
    }

    getBytes() {
        const startByte = Math.floor(this.l / 8);
        const endByte = Math.ceil(this.r / 8);
        return new Uint8Array(this.buf.slice(startByte, endByte));
    }
}

// --- 2. LSB Steganography Engine ---
const LSB_COUNT = 2; // Default bit-depth used by pygano

function lsbEncode(medium, secretQueue, count) {
    for (let i = 0; i < medium.length; i++) {
        if (secretQueue.length === 0) break;
        medium[i] &= ~((1 << count) - 1);
        medium[i] |= secretQueue.pop(count);
    }
}

function lsbEncodeSized(medium, secretBytes, count) {
    const sizeBits = secretBytes.length * 8;
    const sizeBytes = new Uint8Array(8);
    const view = new DataView(sizeBytes.buffer);
    view.setBigUint64(0, BigInt(sizeBits), false); // Big endian

    const combinedBytes = new Uint8Array(8 + secretBytes.length);
    combinedBytes.set(sizeBytes, 0);
    combinedBytes.set(secretBytes, 8);

    const queue = new BitQueue(combinedBytes);
    lsbEncode(medium, queue, count);
}

function lsbDecodeSized(medium, count) {
    const sizeBytesNeeded = Math.ceil((8 * 8) / count); // 32 for count=2
    if (medium.length < sizeBytesNeeded) {
        throw new Error("Medium file is too small to contain a secret size header.");
    }
    const sizeMedium = medium.slice(0, sizeBytesNeeded);
    const remainingMedium = medium.slice(sizeBytesNeeded);

    const sizeQueue = new BitQueue();
    for (let i = 0; i < sizeMedium.length; i++) {
        sizeQueue.extend(sizeMedium[i] & ((1 << count) - 1), count);
    }
    const sizeBits = Number(sizeQueue.pop(8 * 8));

    const totalBytesNeeded = Math.ceil(sizeBits / count);
    if (remainingMedium.length < totalBytesNeeded) {
        throw new Error(`Data corruption detected: medium contains only ${remainingMedium.length} samples, but size header specifies ${totalBytesNeeded} samples.`);
    }

    const payloadQueue = new BitQueue();
    for (let i = 0; i < remainingMedium.length && payloadQueue.length < sizeBits; i++) {
        payloadQueue.extend(remainingMedium[i] & ((1 << count) - 1), count);
    }
    return payloadQueue.getBytes();
}

// --- 3. Text Steganography Engine (ZWSP) ---
const CHARMAP = ["\u200b", "\u200c", "\u200d", "\u2063"];

function textEncode(mediumText, secretBytes) {
    let printIdx = -1;
    for (let i = 0; i < mediumText.length; i++) {
        const code = mediumText.charCodeAt(i);
        // Standard printable ASCII or unicode characters
        if ((code >= 32 && code <= 126) || code > 160) {
            printIdx = i;
            break;
        }
    }

    if (printIdx === -1) {
        throw new Error("Medium text does not contain any printable characters to attach secret to.");
    }

    let before = mediumText.substring(0, printIdx + 1);
    const after = mediumText.substring(printIdx + 1);

    const queue = new BitQueue(secretBytes);
    while (queue.length > 0) {
        const charIdx = queue.pop(2);
        before += CHARMAP[charIdx];
    }

    return before + after;
}

function textDecode(mediumText) {
    const idxs = [];
    for (let i = 0; i < mediumText.length; i++) {
        const char = mediumText[i];
        const idx = CHARMAP.indexOf(char);
        if (idx !== -1) {
            idxs.push(idx);
        }
    }

    if (idxs.length === 0) {
        throw new Error("No hidden message found in this text container.");
    }

    const queue = new BitQueue();
    for (let i = 0; i < idxs.length; i++) {
        queue.extend(idxs[i], 2);
    }

    return queue.getBytes();
}

// --- 4. WAV Audio Parser ---
function parseWav(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) { // "RIFF"
        throw new Error("Invalid WAV file: missing RIFF header");
    }
    if (bytes[8] !== 0x57 || bytes[9] !== 0x41 || bytes[10] !== 0x56 || bytes[11] !== 0x45) { // "WAVE"
        throw new Error("Invalid WAV file: missing WAVE format");
    }

    let dataOffset = -1;
    for (let i = 12; i < bytes.length - 8; i++) {
        if (bytes[i] === 0x64 && bytes[i+1] === 0x61 && bytes[i+2] === 0x74 && bytes[i+3] === 0x61) { // "data"
            dataOffset = i;
            break;
        }
    }

    if (dataOffset === -1) {
        throw new Error("Invalid WAV file: missing 'data' subchunk");
    }

    const view = new DataView(arrayBuffer);
    const dataSize = view.getUint32(dataOffset + 4, true); // Little endian
    const samplesOffset = dataOffset + 8;

    const actualDataSize = bytes.length - samplesOffset;
    if (dataSize > actualDataSize) {
        throw new Error("Invalid WAV file: data chunk size header exceeds file bounds.");
    }

    return {
        bytes: bytes,
        samplesOffset: samplesOffset,
        dataSize: dataSize
    };
}

// --- 5. UI Controller State ---
let mediumType = "image"; // image, audio, text
let secretInputMode = "text"; // text, file

let uploadedMediumFile = null;
let uploadedSecretFile = null;

// Keep track of loaded medium properties for capacity checks
let maxCapacityBytes = 0;
let secretBytesToEncode = new Uint8Array(0);

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
    // Tab selectors
    const tabEncode = document.getElementById("tab-encode");
    const tabDecode = document.getElementById("tab-decode");
    const panelEncode = document.getElementById("panel-encode");
    const panelDecode = document.getElementById("panel-decode");

    // Medium Type selectors
    const selectMediumType = document.getElementById("medium-type-select");
    const selectMediumTypeDecode = document.getElementById("medium-type-select-decode");

    // File Input Elements
    const dropMedium = document.getElementById("drop-medium");
    const inputMedium = document.getElementById("input-medium");
    const previewMedium = document.getElementById("preview-medium");

    const dropSecretFile = document.getElementById("drop-secret");
    const inputSecretFile = document.getElementById("input-secret-file");
    const textSecretInput = document.getElementById("text-secret-input");

    const secretModeText = document.getElementById("secret-mode-text");
    const secretModeFile = document.getElementById("secret-mode-file");
    const secretInputTextWrapper = document.getElementById("secret-input-text-wrapper");
    const secretInputFileWrapper = document.getElementById("secret-input-file-wrapper");

    // Decode elements
    const dropDecodeMedium = document.getElementById("drop-decode-medium");
    const inputDecodeMedium = document.getElementById("input-decode-medium");
    const previewDecodeMedium = document.getElementById("preview-decode-medium");

    // Capacity indicator
    const capacityIndicator = document.getElementById("capacity-indicator");
    const capacityBar = document.getElementById("capacity-bar");
    const capacityText = document.getElementById("capacity-text");

    // Actions
    const btnEncode = document.getElementById("btn-encode");
    const btnDecode = document.getElementById("btn-decode");
    const statusBox = document.getElementById("status-box");

    // --- Tab Switching ---
    tabEncode.addEventListener("click", () => {
        tabEncode.classList.add("active");
        tabDecode.classList.remove("active");
        panelEncode.classList.remove("hidden");
        panelDecode.classList.add("hidden");
        clearStatus();
    });

    tabDecode.addEventListener("click", () => {
        tabDecode.classList.add("active");
        tabEncode.classList.remove("active");
        panelDecode.classList.remove("hidden");
        panelEncode.classList.add("hidden");
        clearStatus();
    });

    // --- Medium Type Selectors ---
    selectMediumType.addEventListener("change", (e) => {
        mediumType = e.target.value;
        resetMediumUpload();
        updateSecretAndCapacity();
    });

    selectMediumTypeDecode.addEventListener("change", (e) => {
        resetDecodeUpload();
    });

    // --- Secret Mode Selection ---
    secretModeText.addEventListener("click", () => {
        secretModeText.classList.add("active");
        secretModeFile.classList.remove("active");
        secretInputTextWrapper.classList.remove("hidden");
        secretInputFileWrapper.classList.add("hidden");
        secretInputMode = "text";
        updateSecretAndCapacity();
    });

    secretModeFile.addEventListener("click", () => {
        secretModeFile.classList.add("active");
        secretModeText.classList.remove("active");
        secretInputFileWrapper.classList.remove("hidden");
        secretInputTextWrapper.classList.add("hidden");
        secretInputMode = "file";
        updateSecretAndCapacity();
    });

    // Drag and Drop helpers
    function setupDragDrop(dropZone, fileInput, onFileSelected) {
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragover");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                onFileSelected(e.dataTransfer.files[0]);
            }
        });

        dropZone.addEventListener("click", () => {
            fileInput.click();
        });

        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                onFileSelected(e.target.files[0]);
            }
        });
    }

    // Initialize drag-and-drop
    setupDragDrop(dropMedium, inputMedium, handleMediumFile);
    setupDragDrop(dropSecretFile, inputSecretFile, handleSecretFile);
    setupDragDrop(dropDecodeMedium, inputDecodeMedium, handleDecodeMediumFile);

    textSecretInput.addEventListener("input", () => {
        updateSecretAndCapacity();
    });

    // --- Medium File Handler ---
    function handleMediumFile(file) {
        uploadedMediumFile = file;
        dropMedium.querySelector("p").textContent = `Selected Container: ${file.name} (${formatBytes(file.size)})`;

        // Automatically detect file type from extension and update selection
        const ext = file.name.split('.').pop().toLowerCase();
        let detectedType = null;
        if (ext === "txt") {
            detectedType = "text";
        } else if (ext === "wav" || ext === "wave") {
            detectedType = "audio";
        } else if (["png", "bmp", "jpg", "jpeg", "tiff", "gif"].includes(ext)) {
            detectedType = "image";
        }

        if (detectedType && detectedType !== mediumType) {
            mediumType = detectedType;
            selectMediumType.value = detectedType;
        }

        if (mediumType === "image") {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    previewMedium.innerHTML = "";
                    previewMedium.appendChild(img);
                    previewMedium.classList.remove("hidden");
                    // Compute capacity: width * height * 3 channels * LSB_COUNT bits minus size header, converted to bytes
                    const totalBits = img.width * img.height * 3 * LSB_COUNT;
                    maxCapacityBytes = Math.floor((totalBits - 64) / 8);
                    updateSecretAndCapacity();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (mediumType === "audio") {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wav = parseWav(e.target.result);
                    previewMedium.innerHTML = `<audio controls src="${URL.createObjectURL(file)}"></audio>`;
                    previewMedium.classList.remove("hidden");
                    // Compute capacity: WAV data sample bytes * LSB_COUNT bits minus size header, converted to bytes
                    const totalBits = wav.dataSize * LSB_COUNT;
                    maxCapacityBytes = Math.floor((totalBits - 64) / 8);
                    updateSecretAndCapacity();
                } catch (err) {
                    showStatus(err.message, "error");
                    resetMediumUpload();
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (mediumType === "text") {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewMedium.innerHTML = `<div class="text-preview">${escapeHtml(e.target.result.slice(0, 1000))}${e.target.result.length > 1000 ? "..." : ""}</div>`;
                previewMedium.classList.remove("hidden");
                // Text has no strictly limited capacity
                maxCapacityBytes = -1; 
                updateSecretAndCapacity();
            };
            reader.readAsText(file);
        }
    }

    // --- Secret File Handler ---
    function handleSecretFile(file) {
        uploadedSecretFile = file;
        dropSecretFile.querySelector("p").textContent = `Selected Secret: ${file.name} (${formatBytes(file.size)})`;
        const reader = new FileReader();
        reader.onload = (e) => {
            secretBytesToEncode = new Uint8Array(e.target.result);
            updateSecretAndCapacity();
        };
        reader.readAsArrayBuffer(file);
    }

    // --- Decode Medium File Handler ---
    function handleDecodeMediumFile(file) {
        // Automatically detect file type from extension and update selection
        const ext = file.name.split('.').pop().toLowerCase();
        let detectedType = null;
        if (ext === "txt") {
            detectedType = "text";
        } else if (ext === "wav" || ext === "wave") {
            detectedType = "audio";
        } else if (["png", "bmp", "jpg", "jpeg", "tiff", "gif"].includes(ext)) {
            detectedType = "image";
        }

        if (detectedType && detectedType !== selectMediumTypeDecode.value) {
            selectMediumTypeDecode.value = detectedType;
        }

        const selectMode = selectMediumTypeDecode.value;
        dropDecodeMedium.querySelector("p").textContent = `Container to Decode: ${file.name} (${formatBytes(file.size)})`;

        if (selectMode === "image") {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    previewDecodeMedium.innerHTML = "";
                    previewDecodeMedium.appendChild(img);
                    previewDecodeMedium.classList.remove("hidden");
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (selectMode === "audio") {
            previewDecodeMedium.innerHTML = `<audio controls src="${URL.createObjectURL(file)}"></audio>`;
            previewDecodeMedium.classList.remove("hidden");
        } else if (selectMode === "text") {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewDecodeMedium.innerHTML = `<div class="text-preview">${escapeHtml(e.target.result.slice(0, 1000))}${e.target.result.length > 1000 ? "..." : ""}</div>`;
                previewDecodeMedium.classList.remove("hidden");
            };
            reader.readAsText(file);
        }
    }

    // --- Capacity Display Sync ---
    function updateSecretAndCapacity() {
        if (secretInputMode === "text") {
            const encoder = new TextEncoder();
            secretBytesToEncode = encoder.encode(textSecretInput.value);
        }

        const size = secretBytesToEncode.length;

        if (maxCapacityBytes === -1 || mediumType === "text") {
            // Text mode
            capacityIndicator.classList.add("hidden");
            btnEncode.removeAttribute("disabled");
            return;
        }

        if (!uploadedMediumFile) {
            capacityIndicator.classList.add("hidden");
            btnEncode.setAttribute("disabled", "true");
            return;
        }

        capacityIndicator.classList.remove("hidden");

        const percent = Math.min(100, Math.floor((size / maxCapacityBytes) * 100));
        capacityBar.style.width = `${percent}%`;
        capacityText.textContent = `${formatBytes(size)} / ${formatBytes(maxCapacityBytes)} (${percent}% Used)`;

        if (size > maxCapacityBytes) {
            capacityBar.style.backgroundColor = "var(--error)";
            capacityText.style.color = "var(--error)";
            btnEncode.setAttribute("disabled", "true");
            showStatus("Secret size exceeds maximum container capacity. Please use a larger container or a smaller secret.", "error");
        } else {
            capacityBar.style.backgroundColor = "var(--accent)";
            capacityText.style.color = "var(--text-secondary)";
            btnEncode.removeAttribute("disabled");
            clearStatus();
        }
    }

    // --- Reset Helpers ---
    function resetMediumUpload() {
        uploadedMediumFile = null;
        inputMedium.value = "";
        previewMedium.innerHTML = "";
        previewMedium.classList.add("hidden");
        dropMedium.querySelector("p").textContent = "Drag & Drop container file here or Click to upload";
        maxCapacityBytes = 0;
        updateSecretAndCapacity();
    }

    function resetDecodeUpload() {
        inputDecodeMedium.value = "";
        previewDecodeMedium.innerHTML = "";
        previewDecodeMedium.classList.add("hidden");
        dropDecodeMedium.querySelector("p").textContent = "Drag & Drop container file here or Click to upload";
    }

    // --- Encode Action Trigger ---
    btnEncode.addEventListener("click", () => {
        if (!uploadedMediumFile) {
            showStatus("Please upload a container medium file.", "error");
            return;
        }
        if (secretBytesToEncode.length === 0) {
            showStatus("Please enter or upload a secret to hide.", "error");
            return;
        }

        showStatus("Encoding secret, please wait...", "info");

        setTimeout(() => {
            try {
                if (mediumType === "image") {
                    const img = previewMedium.querySelector("img");
                    const canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);

                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imgData.data;

                    const rgb = [];
                    for (let i = 0; i < data.length; i += 4) {
                        rgb.push(data[i], data[i+1], data[i+2]);
                    }

                    lsbEncodeSized(rgb, secretBytesToEncode, LSB_COUNT);

                    let rgbIdx = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = rgb[rgbIdx++];
                        data[i+1] = rgb[rgbIdx++];
                        data[i+2] = rgb[rgbIdx++];
                    }

                    ctx.putImageData(imgData, 0, 0);

                    canvas.toBlob((blob) => {
                        triggerDownload(blob, `stego_${getFilenameWithoutExtension(uploadedMediumFile.name)}.png`);
                        showStatus("Encoding complete! Your stego PNG image has been downloaded.", "success");
                    }, "image/png");

                } else if (mediumType === "audio") {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const wav = parseWav(e.target.result);
                            // Get a view of the audio samples
                            const samplesView = wav.bytes.subarray(wav.samplesOffset, wav.samplesOffset + wav.dataSize);
                            lsbEncodeSized(samplesView, secretBytesToEncode, LSB_COUNT);

                            const blob = new Blob([wav.bytes], { type: "audio/wav" });
                            triggerDownload(blob, `stego_${uploadedMediumFile.name}`);
                            showStatus("Encoding complete! Your stego WAV audio has been downloaded.", "success");
                        } catch (err) {
                            showStatus(err.message, "error");
                        }
                    };
                    reader.readAsArrayBuffer(uploadedMediumFile);

                } else if (mediumType === "text") {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const resultText = textEncode(e.target.result, secretBytesToEncode);
                            const blob = new Blob([resultText], { type: "text/plain;charset=utf-8" });
                            triggerDownload(blob, `stego_${uploadedMediumFile.name}`);
                            showStatus("Encoding complete! Your stego text file has been downloaded.", "success");
                        } catch (err) {
                            showStatus(err.message, "error");
                        }
                    };
                    reader.readAsText(uploadedMediumFile);
                }
            } catch (err) {
                showStatus(`Encoding failed: ${err.message}`, "error");
            }
        }, 100);
    });

    // --- Decode Action Trigger ---
    btnDecode.addEventListener("click", () => {
        const fileInput = inputDecodeMedium.files[0];
        if (!fileInput) {
            showStatus("Please upload a container file to decode.", "error");
            return;
        }

        const selectMode = selectMediumTypeDecode.value;
        showStatus("Decoding hidden message, please wait...", "info");

        setTimeout(() => {
            try {
                if (selectMode === "image") {
                    const img = previewDecodeMedium.querySelector("img");
                    const canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);

                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imgData.data;

                    const rgb = [];
                    for (let i = 0; i < data.length; i += 4) {
                        rgb.push(data[i], data[i+1], data[i+2]);
                    }

                    const decodedBytes = lsbDecodeSized(rgb, LSB_COUNT);
                    handleDecodedOutput(decodedBytes);

                } else if (selectMode === "audio") {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const wav = parseWav(e.target.result);
                            const samplesView = wav.bytes.subarray(wav.samplesOffset, wav.samplesOffset + wav.dataSize);
                            const decodedBytes = lsbDecodeSized(samplesView, LSB_COUNT);
                            handleDecodedOutput(decodedBytes);
                        } catch (err) {
                            showStatus(`Decoding failed: ${err.message}`, "error");
                        }
                    };
                    reader.readAsArrayBuffer(fileInput);

                } else if (selectMode === "text") {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const decodedBytes = textDecode(e.target.result);
                            handleDecodedOutput(decodedBytes);
                        } catch (err) {
                            showStatus(`Decoding failed: ${err.message}`, "error");
                        }
                    };
                    reader.readAsText(fileInput);
                }
            } catch (err) {
                showStatus(`Decoding failed: ${err.message}`, "error");
            }
        }, 100);
    });

    // --- Output Handling ---
    function handleDecodedOutput(decodedBytes) {
        // Try decoding as text first
        let isText = true;
        let textResult = "";
        try {
            const decoder = new TextDecoder("utf-8", { fatal: true });
            textResult = decoder.decode(decodedBytes);
        } catch (e) {
            isText = false;
        }

        if (isText) {
            // Show as HTML dialog and offer download
            statusBox.className = "status-container success";
            statusBox.innerHTML = `
                <p class="status-title">Decoding Successful!</p>
                <div class="result-message">
                    <strong>Decoded message:</strong>
                    <pre>${escapeHtml(textResult)}</pre>
                </div>
                <button id="btn-download-secret" class="btn btn-secondary" style="margin-top: 10px;">Download as Text File</button>
            `;
            statusBox.classList.remove("hidden");

            document.getElementById("btn-download-secret").addEventListener("click", () => {
                const blob = new Blob([decodedBytes], { type: "text/plain;charset=utf-8" });
                triggerDownload(blob, "decoded_secret.txt");
            });
        } else {
            // Output is binary, download directly
            const blob = new Blob([decodedBytes], { type: "application/octet-stream" });
            triggerDownload(blob, "decoded_secret.bin");
            showStatus("Decoding successful! Binary payload (not UTF-8 text) detected. File downloaded as 'decoded_secret.bin'.", "success");
        }
    }

    // --- General Utility Helpers ---
    function showStatus(msg, type) {
        statusBox.className = `status-container ${type}`;
        statusBox.innerHTML = `<p>${escapeHtml(msg)}</p>`;
        statusBox.classList.remove("hidden");
    }

    function clearStatus() {
        statusBox.className = "status-container hidden";
        statusBox.innerHTML = "";
    }

    function triggerDownload(blob, filename) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    function getFilenameWithoutExtension(filename) {
        return filename.substring(0, filename.lastIndexOf(".")) || filename;
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
