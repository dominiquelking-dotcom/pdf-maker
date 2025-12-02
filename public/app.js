(function () {
  // Detect local pdf-lib (served from /vendor/pdf-lib)
  var hasPdfLib = !!window.PDFLib;
  var PDFLibRef = hasPdfLib ? window.PDFLib : null;
  var PDFDocument = hasPdfLib ? PDFLibRef.PDFDocument : null;
  var StandardFonts = hasPdfLib ? PDFLibRef.StandardFonts : null;
  var rgb = hasPdfLib ? PDFLibRef.rgb : null;

  // DOM elements
  var fileInput;
  var docTitleInput;
  var docNotesInput;
  var signerNameInput;
  var signerTitleInput;
  var applyBtn;
  var downloadBtn;
  var statusBar;
  var pdfFrame;
  var pdfPlaceholder;
  var viewerBody;
  var signatureOverlay;
  var signatureTextEl;

  // State
  var originalBytes = null;
  var currentBytes = null;
  var originalFileName = "";
  var hasSignature = false;

  // Drag state
  var isDragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var sigStartLeft = 0;
  var sigStartTop = 0;
  var sigPosition = { left: null, top: null }; // px within viewerBody

  // ------------ Init ------------

  function init() {
    fileInput = document.getElementById("pdfFile");
    docTitleInput = document.getElementById("docTitle");
    docNotesInput = document.getElementById("docNotes");
    signerNameInput = document.getElementById("signerName");
    signerTitleInput = document.getElementById("signerTitle");
    applyBtn = document.getElementById("applySignatureBtn");
    downloadBtn = document.getElementById("downloadBtn");
    statusBar = document.getElementById("statusBar");
    pdfFrame = document.getElementById("pdfFrame");
    pdfPlaceholder = document.getElementById("pdfPlaceholder");
    viewerBody = document.querySelector(".viewer-body");
    signatureOverlay = document.getElementById("signatureOverlay");
    signatureTextEl = document.getElementById("signatureText");

    if (!fileInput || !applyBtn || !downloadBtn || !pdfFrame || !viewerBody) {
      console.error("PDF Studio DOM not found. Check element IDs in index.html.");
      return;
    }

    // Events
    fileInput.addEventListener("change", onFileChange);
    applyBtn.addEventListener("click", onApplySignatureClicked);
    downloadBtn.addEventListener("click", onDownloadClicked);
    signerNameInput.addEventListener("input", updateSignatureText);

    if (signatureOverlay) {
      signatureOverlay.addEventListener("mousedown", onSignatureMouseDown);
      window.addEventListener("mousemove", onSignatureMouseMove);
      window.addEventListener("mouseup", onSignatureMouseUp);
    }

    setButtonsEnabled(false);

    if (!hasPdfLib) {
      setStatus(
        "Viewer is ready. Signing is disabled because the PDF engine (pdf-lib) did not load.",
        "error"
      );
      console.error("PDFLib not found. Check server /vendor/pdf-lib.");
    } else {
      setStatus("Load a PDF to get started. Drag the cursive signature on the preview.", "info");
      console.log("PDF Studio initialized, pdf-lib loaded.");
    }
  }

  // ------------ Helpers ------------

  function setStatus(message, type) {
    if (!statusBar) return;

    statusBar.textContent = message || "";
    statusBar.classList.remove("status-info", "status-success", "status-error");

    if (type === "success") {
      statusBar.classList.add("status-success");
    } else if (type === "error") {
      statusBar.classList.add("status-error");
    } else {
      statusBar.classList.add("status-info");
    }
  }

  function setButtonsEnabled(enabled) {
    applyBtn.disabled = !enabled;
    downloadBtn.disabled = !enabled;
  }

  function clearPreview() {
    if (pdfFrame) {
      pdfFrame.src = "";
    }
    if (pdfPlaceholder) {
      pdfPlaceholder.style.display = "block";
    }
    if (signatureOverlay) {
      signatureOverlay.style.display = "none";
    }
  }

  function updatePreview(bytes) {
    if (!pdfFrame || !bytes) return;

    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);

    pdfFrame.src = url;

    pdfFrame.onload = function () {
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    };

    if (pdfPlaceholder) {
      pdfPlaceholder.style.display = "none";
    }

    // After load, show signature overlay in a default spot
    if (signatureOverlay) {
      placeSignatureDefault();
    }
  }

  function updateSignatureText() {
    if (!signatureTextEl) return;
    var name = (signerNameInput.value || "").trim();
    signatureTextEl.textContent = name || "Signature";
  }

  function placeSignatureDefault() {
    if (!viewerBody || !signatureOverlay) return;

    viewerBody.style.position = "relative";

    var vbWidth = viewerBody.clientWidth || 800;
    var vbHeight = viewerBody.clientHeight || 600;

    var approxWidth = 200;
    var approxHeight = 50;

    var left = vbWidth - approxWidth - 40;
    if (left < 20) left = 20;
    var top = vbHeight - approxHeight - 40;
    if (top < 20) top = 20;

    signatureOverlay.style.display = "block";
    signatureOverlay.style.left = left + "px";
    signatureOverlay.style.top = top + "px";

    sigPosition.left = left;
    sigPosition.top = top;
  }

  // ------------ Drag logic ------------

  function onSignatureMouseDown(e) {
    if (!signatureOverlay || !viewerBody) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    sigStartLeft = parseFloat(signatureOverlay.style.left || "0");
    sigStartTop = parseFloat(signatureOverlay.style.top || "0");

    e.preventDefault();
  }

  function onSignatureMouseMove(e) {
    if (!isDragging || !signatureOverlay || !viewerBody) return;

    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;

    var newLeft = sigStartLeft + dx;
    var newTop = sigStartTop + dy;

    var vbRect = viewerBody.getBoundingClientRect();
    var overlayRect = signatureOverlay.getBoundingClientRect();

    var maxLeft = vbRect.width - overlayRect.width - 10;
    var maxTop = vbRect.height - overlayRect.height - 10;

    if (newLeft < 10) newLeft = 10;
    if (newTop < 10) newTop = 10;
    if (newLeft > maxLeft) newLeft = maxLeft;
    if (newTop > maxTop) newTop = maxTop;

    signatureOverlay.style.left = newLeft + "px";
    signatureOverlay.style.top = newTop + "px";

    sigPosition.left = newLeft;
    sigPosition.top = newTop;
  }

  function onSignatureMouseUp() {
    isDragging = false;
  }

  // ------------ File handling ------------

  function onFileChange(e) {
    var file = e.target.files && e.target.files[0];

    if (!file) {
      originalBytes = null;
      currentBytes = null;
      originalFileName = "";
      hasSignature = false;
      clearPreview();
      setButtonsEnabled(false);
      setStatus("No file selected.", "info");
      return;
    }

    var isPdf =
      (file.type && file.type.toLowerCase().indexOf("pdf") !== -1) ||
      /\.pdf$/i.test(file.name);

    if (!isPdf) {
      setStatus("That file does not look like a PDF.", "error");
      fileInput.value = "";
      clearPreview();
      setButtonsEnabled(false);
      return;
    }

    originalFileName = (file.name || "document").replace(/\.pdf$/i, "") || "document";

    var reader = new FileReader();

    reader.onload = function (ev) {
      try {
        var buffer = ev.target.result;
        originalBytes = new Uint8Array(buffer);
        currentBytes = originalBytes.slice(0); // copy
        hasSignature = false;

        updateSignatureText();
        updatePreview(currentBytes);
        setButtonsEnabled(true);

        if (hasPdfLib) {
          setStatus(
            "PDF loaded: " + file.name + ". Drag the cursive signature, then apply.",
            "success"
          );
        } else {
          setStatus(
            "PDF loaded: " +
              file.name +
              ". Signing is unavailable because pdf-lib did not load.",
            "error"
          );
        }
      } catch (err) {
        console.error("Error reading PDF:", err);
        originalBytes = null;
        currentBytes = null;
        hasSignature = false;
        clearPreview();
        setButtonsEnabled(false);
        setStatus("Failed to read that PDF file.", "error");
      }
    };

    reader.onerror = function () {
      console.error("FileReader error:", reader.error);
      originalBytes = null;
      currentBytes = null;
      hasSignature = false;
      clearPreview();
      setButtonsEnabled(false);
      setStatus("Failed to read that PDF file.", "error");
    };

    reader.readAsArrayBuffer(file);
  }

  // ------------ Signature logic ------------

  function validateBeforeSign() {
    if (!currentBytes) {
      setStatus("Load a PDF first.", "error");
      return false;
    }

    if (!hasPdfLib) {
      setStatus(
        "Signing is not available because pdf-lib did not load.",
        "error"
      );
      return false;
    }

    var signerName = (signerNameInput.value || "").trim();
    if (!signerName) {
      setStatus("Signer name is required to apply a signature.", "error");
      signerNameInput.focus();
      return false;
    }

    if (signatureOverlay && (sigPosition.left == null || sigPosition.top == null)) {
      setStatus(
        "Move the signature on the preview to place it, then apply.",
        "error"
      );
      return false;
    }

    return true;
  }

  async function onApplySignatureClicked() {
    if (!validateBeforeSign()) return;

    setButtonsEnabled(false);
    setStatus("Applying signature…", "info");

    try {
      var modifiedBytes = await applySignatureToPdf(currentBytes);
      currentBytes = modifiedBytes;
      hasSignature = true;
      updatePreview(currentBytes);
      setStatus("Signature applied. Review the preview, then download.", "success");
    } catch (err) {
      console.error("Failed to apply signature:", err);
      setStatus("Failed to apply signature to this PDF.", "error");
    } finally {
      setButtonsEnabled(true);
    }
  }

  async function applySignatureToPdf(bytes) {
    var pdfDoc = await PDFDocument.load(bytes);

    var pages = pdfDoc.getPages();
    if (!pages || pages.length === 0) {
      throw new Error("PDF has no pages.");
    }

    var firstPage = pages[0];
    var lastPage = pages[pages.length - 1];

    var helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    var helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    var signerName = (signerNameInput.value || "").trim();
    var signerTitle = (signerTitleInput.value || "").trim();
    var docTitle = (docTitleInput.value || "").trim();
    var docNotes = (docNotesInput.value || "").trim();

    var now = new Date();
    var dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // --- Map overlay position into PDF coordinates (last page) ---
    var pageWidth = lastPage.getWidth();
    var pageHeight = lastPage.getHeight();

    var vbWidth = viewerBody ? viewerBody.clientWidth || 1 : 1;
    var vbHeight = viewerBody ? viewerBody.clientHeight || 1 : 1;

    // Match visually smaller pill
    var overlayWidth = 160;
    var overlayHeight = 32;

    var leftPx = sigPosition.left != null ? sigPosition.left : vbWidth - 240;
    var topPx = sigPosition.top != null ? sigPosition.top : vbHeight - 80;

    // Center of overlay in viewer space
    var centerXRatio = (leftPx + overlayWidth / 2) / vbWidth;
    var centerYRatio = (topPx + overlayHeight / 2) / vbHeight;

    if (centerXRatio < 0) centerXRatio = 0;
    if (centerXRatio > 1) centerXRatio = 1;
    if (centerYRatio < 0) centerYRatio = 0;
    if (centerYRatio > 1) centerYRatio = 1;

    // PDF coords: origin bottom-left, viewer ratios from top-left
    var pdfXCenter = centerXRatio * pageWidth;
    var pdfYFromTop = centerYRatio * pageHeight;
    var pdfY = pageHeight - pdfYFromTop;

    var sigFontSize = 18;

    var pdfX = pdfXCenter - 60;
    if (pdfX < 40) pdfX = 40;
    if (pdfX > pageWidth - 160) pdfX = pageWidth - 160;

    if (pdfY < 40) pdfY = 40;
    if (pdfY > pageHeight - 40) pdfY = pageHeight - 40;

    // --- Black signature ink on PDF ---
    lastPage.drawText(signerName, {
      x: pdfX,
      y: pdfY,
      size: sigFontSize,
      font: helvetica,
      color: rgb(0, 0, 0) // black
    });

    var metaLine = "Date: " + dateStr + (signerTitle ? " · " + signerTitle : "");

    lastPage.drawText(metaLine, {
      x: pdfX,
      y: pdfY - 14,
      size: 9,
      font: helvetica,
      color: rgb(0, 0, 0) // black metadata as well
    });

    // --- Optional document title/notes on first page ---
    if (docTitle || docNotes) {
      var margin = 40;
      var y = firstPage.getHeight() - margin;

      if (docTitle) {
        firstPage.drawText(docTitle, {
          x: margin,
          y: y - 16,
          size: 14,
          font: helveticaBold,
          color: rgb(0.92, 0.99, 0.97)
        });
        y -= 26;
      }

      if (docNotes) {
        var wrapped = wrapText(docNotes, 90);
        wrapped.forEach(function (line) {
          firstPage.drawText(line, {
            x: margin,
            y: y,
            size: 9,
            font: helvetica,
            color: rgb(0.8, 0.9, 1)
          });
          y -= 11;
        });
      }
    }

    var modifiedBytes = await pdfDoc.save();
    return modifiedBytes;
  }

  function wrapText(text, maxCharsPerLine) {
    if (!text) return [];
    var words = text.split(/\s+/);
    var lines = [];
    var current = "";

    words.forEach(function (word) {
      if ((current + " " + word).trim().length > maxCharsPerLine) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = (current + " " + word).trim();
      }
    });

    if (current) lines.push(current);
    return lines;
  }

  // ------------ Download logic ------------

  function onDownloadClicked() {
    if (!currentBytes && !originalBytes) {
      setStatus("Nothing to download yet. Load a PDF first.", "error");
      return;
    }

    var bytesToUse = currentBytes || originalBytes;
    var baseName = originalFileName || "document";
    var filename = hasSignature ? baseName + "-signed.pdf" : baseName + ".pdf";

    if (hasSignature) {
      setStatus("Downloading signed PDF.", "success");
    } else {
      setStatus("Downloading original (unsigned) PDF.", "info");
    }

    triggerDownload(bytesToUse, filename);
  }

  function triggerDownload(bytes, filename) {
    try {
      var blob = new Blob([bytes], { type: "application/pdf" });
      var url = URL.createObjectURL(blob);

      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error("Download error:", err);
      setStatus("Browser blocked the download or an error occurred.", "error");
    }
  }

  // ------------ Wire up ------------

  document.addEventListener("DOMContentLoaded", init);
})();

