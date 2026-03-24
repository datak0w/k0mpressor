const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const keepRatioInput = document.getElementById("keepRatio");
const optimizeInput = document.getElementById("optimize");
const outputFormatInput = document.getElementById("outputFormat");
const outputSizeInput = document.getElementById("outputSize");
const useSocialFormatsInput = document.getElementById("useSocialFormats");
const socialOptionsEl = document.getElementById("socialOptions");
const socialSelectAllInput = document.getElementById("socialSelectAll");
const socialPresetInputs = [...document.querySelectorAll("[data-social-preset]")];
const qualityInput = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const qualityRow = document.getElementById("qualityRow");
const backgroundColorInput = document.getElementById("backgroundColor");
const fileCountEl = document.getElementById("fileCount");
const totalSizeEl = document.getElementById("totalSize");
const fileListEl = document.getElementById("fileList");
const previewGridEl = document.getElementById("previewGrid");
const progressBar = document.getElementById("progressBar");
const statusEl = document.getElementById("status");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

/** @type {File[]} */
let selectedFiles = [];
let isProcessing = false;
const previewUrlMap = new Map();

function bytesToMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function sanitizeName(name) {
  return name.replace(/[^\w.-]+/g, "_");
}

function extensionForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function parseSize(value) {
  const [widthRaw, heightRaw] = String(value).split("x");
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1080, height: 1080 };
  }
  return { width, height };
}

function syncSocialVisibility() {
  const enabled = Boolean(useSocialFormatsInput && useSocialFormatsInput.checked);
  if (socialOptionsEl) {
    socialOptionsEl.classList.toggle("hidden", !enabled);
  }
  if (outputSizeInput) {
    outputSizeInput.disabled = enabled;
  }
}

function parseSocialPreset(rawValue) {
  const [folder, label, sizeRaw] = String(rawValue).split("|");
  const { width, height } = parseSize(sizeRaw);
  return {
    folder: sanitizeName(folder || "social"),
    label: sanitizeName(label || "Preset"),
    width,
    height,
  };
}

function getActiveSocialPresets() {
  return socialPresetInputs.filter((input) => input.checked).map((input) => parseSocialPreset(input.value));
}

function setBusyState(busy) {
  isProcessing = busy;
  clearBtn.disabled = busy || selectedFiles.length === 0;
  downloadBtn.disabled = busy || selectedFiles.length === 0;
  fileInput.disabled = busy;
}

function refreshUi() {
  const size = selectedFiles.reduce((acc, file) => acc + file.size, 0);
  fileCountEl.textContent = String(selectedFiles.length);
  totalSizeEl.textContent = bytesToMb(size);
  clearBtn.disabled = selectedFiles.length === 0 || isProcessing;
  downloadBtn.disabled = selectedFiles.length === 0 || isProcessing;
  fileListEl.innerHTML = "";
  previewGridEl.innerHTML = "";

  const preview = selectedFiles.slice(0, 120);
  for (const file of preview) {
    const item = document.createElement("li");
    item.textContent = `${file.name} (${bytesToMb(file.size)})`;
    fileListEl.appendChild(item);
  }
  if (selectedFiles.length > preview.length) {
    const remaining = document.createElement("li");
    remaining.textContent = `... and ${selectedFiles.length - preview.length} more`;
    fileListEl.appendChild(remaining);
  }

  const previewLimit = 40;
  const filesForPreview = selectedFiles.slice(0, previewLimit);
  for (const file of filesForPreview) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    let url = previewUrlMap.get(key);
    if (!url) {
      url = URL.createObjectURL(file);
      previewUrlMap.set(key, url);
    }

    const card = document.createElement("article");
    card.className = "preview-card";

    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;
    img.loading = "lazy";

    const meta = document.createElement("div");
    meta.className = "preview-meta";
    const name = document.createElement("p");
    name.textContent = file.name;
    const info = document.createElement("p");
    info.textContent = bytesToMb(file.size);
    meta.append(name, info);
    card.append(img, meta);
    previewGridEl.appendChild(card);
  }

  if (selectedFiles.length > previewLimit) {
    const more = document.createElement("div");
    more.className = "preview-more";
    more.textContent = `+${selectedFiles.length - previewLimit} more files`;
    previewGridEl.appendChild(more);
  }
}

function addFiles(files) {
  const valid = files.filter((file) => ACCEPTED_TYPES.has(file.type));
  const dedupeMap = new Map(selectedFiles.map((f) => [`${f.name}:${f.size}`, f]));
  for (const file of valid) {
    dedupeMap.set(`${file.name}:${file.size}`, file);
  }
  selectedFiles = [...dedupeMap.values()];
  refreshUi();

  const skipped = files.length - valid.length;
  if (skipped > 0) {
    statusEl.textContent = `Skipped ${skipped} unsupported files.`;
  } else {
    statusEl.textContent = `Loaded ${valid.length} files.`;
  }
}

function fileToImageBitmap(file) {
  return createImageBitmap(file);
}

function blobFromCanvas(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image conversion failed."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

async function resizeFile(file, options) {
  const image = await fileToImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = options.targetWidth;
  canvas.height = options.targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    image.close();
    throw new Error("Could not initialize canvas.");
  }

  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, options.targetWidth, options.targetHeight);

  if (options.keepRatio) {
    const scale = Math.min(options.targetWidth / image.width, options.targetHeight / image.height);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const x = Math.floor((options.targetWidth - width) / 2);
    const y = Math.floor((options.targetHeight - height) / 2);
    ctx.drawImage(image, x, y, width, height);
  } else {
    ctx.drawImage(image, 0, 0, options.targetWidth, options.targetHeight);
  }

  image.close();
  const quality = options.optimize ? options.quality : 0.95;
  return blobFromCanvas(canvas, options.mimeType, quality);
}

async function buildZip() {
  if (!window.JSZip) {
    throw new Error("JSZip is not available.");
  }
  if (selectedFiles.length === 0) {
    statusEl.textContent = "No files to process.";
    return;
  }

  const selectedSizeValue = outputSizeInput ? outputSizeInput.value : "1080x1080";
  const { width: targetWidth, height: targetHeight } = parseSize(selectedSizeValue);
  const options = {
    keepRatio: keepRatioInput.checked,
    optimize: optimizeInput.checked,
    mimeType: outputFormatInput.value,
    quality: Number(qualityInput.value) / 100,
    backgroundColor: backgroundColorInput.value,
    targetWidth,
    targetHeight,
  };
  const ext = extensionForMime(options.mimeType);
  const zip = new JSZip();
  progressBar.value = 0;
  statusEl.textContent = "Processing images...";
  setBusyState(true);

  try {
    const socialModeEnabled = Boolean(useSocialFormatsInput && useSocialFormatsInput.checked);
    if (socialModeEnabled) {
      const presets = getActiveSocialPresets();
      if (presets.length === 0) {
        statusEl.textContent = "Select at least one social format.";
        return;
      }

      const presetsWithStandard = [
        ...presets,
        {
          folder: "standard",
          label: "Standard_1080x1080",
          width: 1080,
          height: 1080,
        },
      ];

      const totalTasks = selectedFiles.length * presetsWithStandard.length;
      let doneTasks = 0;

      for (let i = 0; i < selectedFiles.length; i += 1) {
        const file = selectedFiles[i];
        const baseName = sanitizeName(file.name.replace(/\.[^.]+$/, ""));

        for (const preset of presetsWithStandard) {
          const outputBlob = await resizeFile(file, {
            ...options,
            targetWidth: preset.width,
            targetHeight: preset.height,
          });
          zip.file(
            `${preset.folder}/${preset.label}/${baseName}_${preset.width}x${preset.height}.${ext}`,
            outputBlob
          );
          doneTasks += 1;
          const progress = Math.round((doneTasks / totalTasks) * 90);
          progressBar.value = progress;
          statusEl.textContent = `Processing ${doneTasks}/${totalTasks} (${preset.width}x${preset.height})...`;
        }
      }
    } else {
      for (let i = 0; i < selectedFiles.length; i += 1) {
        const file = selectedFiles[i];
        const outputBlob = await resizeFile(file, options);
        const baseName = sanitizeName(file.name.replace(/\.[^.]+$/, ""));
        zip.file(`${baseName}_${options.targetWidth}x${options.targetHeight}.${ext}`, outputBlob);

        const progress = Math.round(((i + 1) / selectedFiles.length) * 90);
        progressBar.value = progress;
        statusEl.textContent = `Processing ${i + 1}/${selectedFiles.length}...`;
      }
    }

    statusEl.textContent = "Generating ZIP...";
    const zipBlob = await zip.generateAsync(
      { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
      (meta) => {
        progressBar.value = 90 + Math.round(meta.percent * 0.1);
      }
    );

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kompressor-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    progressBar.value = 100;
    statusEl.textContent = "Done. ZIP downloaded.";
  } finally {
    setBusyState(false);
  }
}

function clearAll() {
  if (isProcessing) return;
  for (const url of previewUrlMap.values()) {
    URL.revokeObjectURL(url);
  }
  previewUrlMap.clear();
  selectedFiles = [];
  progressBar.value = 0;
  statusEl.textContent = "Queue cleared.";
  fileInput.value = "";
  refreshUi();
}

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("active");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("active");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("active");
  const files = [...event.dataTransfer.files];
  addFiles(files);
});

dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  const files = [...fileInput.files];
  addFiles(files);
});

qualityInput.addEventListener("input", () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

function toggleQualityVisibility() {
  const selectedFormat = outputFormatInput.value;
  const showQuality = selectedFormat !== "image/png";
  qualityRow.style.display = showQuality ? "flex" : "none";
}

outputFormatInput.addEventListener("change", toggleQualityVisibility);
if (useSocialFormatsInput) {
  useSocialFormatsInput.addEventListener("change", syncSocialVisibility);
}
if (socialSelectAllInput) {
  socialSelectAllInput.addEventListener("change", () => {
    for (const input of socialPresetInputs) {
      input.checked = socialSelectAllInput.checked;
    }
  });
}
for (const input of socialPresetInputs) {
  input.addEventListener("change", () => {
    if (!socialSelectAllInput) return;
    socialSelectAllInput.checked = socialPresetInputs.every((item) => item.checked);
  });
}
clearBtn.addEventListener("click", clearAll);
downloadBtn.addEventListener("click", buildZip);

toggleQualityVisibility();
syncSocialVisibility();
refreshUi();
