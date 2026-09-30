window.printTextPDF = async function printTextPDF() {
  const page = document.getElementById("resumePreview");
  const holder = document.getElementById("a4PreviewHolder");
  const panel = document.getElementById("previewPanel");
  const originalTransform = page.style.transform;
  const originalHolderWidth = holder.style.width;
  const originalHolderHeight = holder.style.height;
  const originalPanelDisplay = panel.style.display;

  if (window.getComputedStyle(panel).display === "none") {
    panel.style.display = "block";
  }
  page.style.transform = "none";
  holder.style.width = "210mm";
  holder.style.height = "297mm";

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    if (typeof window.validateRequiredFields === "function") {
      if (!window.validateRequiredFields()) return;
    } else {
      const data = window.getFormData();
      const required = ["fullName", "designation", "email", "phone", "address", "summary", "experience", "education", "technicalSkills"];
      if (required.some(field => !data[field])) {
        window.showToast("Please complete required fields before printing.", "error");
        return;
      }
    }

    if (window.isResumeOverflowing()) {
      window.showToast("Content exceeds one A4 page. Shorten text or reduce font size before printing.", "error");
      return;
    }

    window.print();
  } finally {
    page.style.transform = originalTransform;
    holder.style.width = originalHolderWidth;
    holder.style.height = originalHolderHeight;
    panel.style.display = originalPanelDisplay;
  }
};
