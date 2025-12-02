(function () {
  // Ensure PDFLib is available
  if (!window.PDFLib) {
    console.error("PDFLib not found. Check the CDN script tag in index.html.");
    return;
  }

  var PDFLibRef = window.PDFLib;
  var PDFDocument = PDFLibRef.PDFDocument;
  var StandardFonts = PDFLibRef.StandardFonts;
  var rgb = PDFLibRef.rgb;

  var fileInput,
    docTitleInput,
    docNotesInput,
    signerNameInput,
    signerTitleInput,
    applyBtn,
    downloadBtn,
    statusBar,
    pdfFrame,
    pdfPlaceholder;

  var originalBytes = null;
  var currentBytes = null;
  var originalFileName = "";

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

    if (!fileInput) {
      console.error("PDF Studio DOM not found.");
      return;
    }

    fileInput.addEventListener("change", onFileChange);
    applyBtn.addEventListener("click", onApplySignatureClicked);
    downloadBtn.addEventListener("click", onDownloadClicked);
  }

  function setStatus(message, type) {
    if (!statusBar) return;
    statusBar.textContent = message || "";
    statusBar.classList.remove("status-info", "status-success", "status-error");
    statusBar.classList.add(type || "status-info");
  }

  function setButtonsEnabled(enabled) {
    applyBtn.disabled = !enabled;
    downloadBtn.disabled = !enabled;
  }

  function onFileChange(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      originalBytes = null;
      currentBytes = null;
      originalFileName = "";
      clearPreview();
      setButtonsEnabled(false);
      setStatus("No file selected.", "status-info");
      return;
    }

    if (!file.type || file.type.indexOf("pdf") === -1) {
      setStatus("That file does not look like a PDF.", "status-error");
      fileInput.value = "";
      clearPreview();
      setButtonsEnabled(false);
      return;
    }

    originalFileName = file.name.replace(/\.pdf$/i, "") || "document";

    var reader = new FileReader();
    reader.onload = function (e) {
      originalBytes = new Uint8Array(e.target.result);
      currentBytes = originalBytes.slice(0); // copy
      updatePreview(currentBytes);
      setButtonsEnabled(true);
      setStatus("PDF loaded: " + file.name, "status-success");
    };
    reader.onerror = function () {
      setStatus("Failed to read that PDF file.", "status-error");
      originalBytes = null;
      currentBytes = null;
      clearPreview();
      setButtonsEnabled(false);
    };

    reader.readAsArrayBuffer(file);
  }

  function clearPreview() {
    if (pdfFrame) {
      pdfFrame.src = "";
    }
    if (pdfPlaceholder) {
      pdfPlaceholder.style.display = "block";
    }
  }

  function updatePreview(bytes) {
    if (!pdfFrame) return;

    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);

    pdfFrame.src = url;
    pdfFrame.onload = function () {
      URL.revokeObjectURL(url);
    };

    if (pdfPlaceholder) {
      pdfPlaceholder.style.display = "none";
    }
  }

  function validateBeforeSign() {
    if (!currentBytes) {
      setStatus("Load a PDF first.", "status-error");
      return false;
    }

    var signerName = (signerNameInput.value || "").trim();
    if (!signerName) {
      setStatus("Signer name is required to apply a signature.", "status-error");
      signerNameInput.focus();
      return false;
    }

    return true;
  }

  async function onApplySignatureClicked() {
    if (!validateBeforeSign()) return;

    setButtonsEnabled(false);
    setStatus("Applying signature…", "status-info");

    try {
      var modified = await applySignatureToPdf(currentBytes);
      currentBytes = modified;
      updatePreview(currentBytes);
      setStatus("Signature applied. Review the preview, then download.", "status-success");
    } catch (err) {
      console.error(err);
      setStatus("Failed to apply signature to this PDF.", "status-error");
    } finally {
      setButtonsEnabled(true);
    }
  }

  async function applySignatureToPdf(bytes) {
    var pdfDoc = await PDFDocument.load(bytes);
    var pages = pdfDoc.getPages();
    var lastPage = pages[pages.length - 1];
    var firstPage = pages[0];

    var helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    var helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    var signerName = (signerNameInput.value || "").trim();
    var signerTitle = (signerTitleInput.value || "").trim();
    var docTitle = (docTitleInput.value || "").trim();
    var docNotes = (docNotesInput.value || "").trim();

    var now = new Date();
    var dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Signature block on last page
    var sigFontSize = 10;
    var margin = 50;

    var signatureLines = [
      "Signed by: " + signerName,
      signerTitle ? "Title: " + signerTitle : null,
      "Date: " + dateStr
    ].filter(Boolean);

    var lineHeight = sigFontSize + 2;
    var totalHeight = signatureLines.length * lineHeight;

    var lastPageWidth = lastPage.getWidth();
    var lastPageHeight = lastPage.getHeight();

    var startX = lastPageWidth - margin - 220;
    if (startX < margin) startX = margin; // clamp
    var startY = margin + totalHeight + 20;

    // Draw a light box
    lastPage.drawRectangle({
      x: startX - 8,
      y: startY - totalHeight - 8,
      width: 220 + 16,
      height: totalHeight + 16,
      borderColor: rgb(0.2, 0.6, 0.9),
      borderWidth: 1,
      color: rgb(0.02, 0.07, 0.14),
      opacity: 0.9
    });

    signatureLines.forEach(function (line, index) {
      lastPage.drawText(line, {
        x: startX,
        y: startY - lineHeight * (index + 1),
        size: sigFontSize,
        font: helvetica,
        color: rgb(0.9, 0.96, 1)
      });
    });

    // Optional title/notes on first page
    if (docTitle || docNotes) {
      var firstWidth = firstPage.getWidth();
      var topMargin = firstPage.getHeight() - margin - 40;
      var textX = margin;
      var y = topMargin;

      if (docTitle) {
        firstPage.drawText(docTitle, {
          x: textX,
          y: y,
          size: 14,
          font: helveticaBold,
          color: rgb(0.9, 0.96, 1)
        });
        y -= 18;
      }

      if (docNotes) {
        var notesLines = wrapText(docNotes, 90);
        notesLines.forEach(function (line) {
          firstPage.drawText(line, {
            x: textX,
            y: y,
            size: 9,
            font: helvetica,
            color: rgb(0.82, 0.9, 1)
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

  function onDownloadClicked() {
    if (!currentBytes && !originalBytes) {
      setStatus("Nothing to download yet.", "status-error");
      return;
    }

    var isSigned = !!currentBytes && originalBytes && !arraysEqual(currentBytes, originalBytes);
    var bytesToUse = currentBytes || originalBytes;
    var base = originalFileName || "document";
    var filename = isSigned ? base + "-signed.pdf" : base + ".pdf";

    if (!isSigned) {
      setStatus("Downloading original (unsigned) PDF.", "status-info");
    } else {
      setStatus("Downloading signed PDF.", "status-success");
    }

    triggerDownload(bytesToUse, filename);
  }

  function arraysEqual(a, b) {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function triggerDownload(bytes, filename) {
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
  }

  document.addEventListener("DOMContentLoaded", init);
})();

