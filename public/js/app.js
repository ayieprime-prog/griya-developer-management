// Griya Developer Management - Client-side JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips and popovers if Bootstrap is available
  if (typeof bootstrap !== 'undefined') {
    // Tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });
  }

  // Delete confirmation
  setupDeleteConfirmation();

  // Auto-submit selects with data-autosubmit attribute
  setupAutoSubmit();

  // Toggle visibility based on select value
  setupToggleSelect();
});

/**
 * Setup delete confirmation dialogs
 */
function setupDeleteConfirmation() {
  const deleteButtons = document.querySelectorAll('[data-confirm]');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      const message = this.getAttribute('data-confirm');
      if (!confirm(message)) {
        e.preventDefault();
      }
    });
  });
}

/**
 * Setup auto-submit for selects
 */
function setupAutoSubmit() {
  const autoSubmitSelects = document.querySelectorAll('[data-autosubmit]');
  autoSubmitSelects.forEach(select => {
    select.addEventListener('change', function() {
      const form = this.closest('form');
      if (form) {
        form.submit();
      }
    });
  });
}

/**
 * Setup toggle select - show/hide elements based on select value
 * Usage:
 *   <select data-toggle-select="#target">
 *     <option value="Menikah">Menikah</option>
 *   </select>
 *   <div id="target" data-toggle-when="Menikah" style="display:none;">
 *     Content to toggle
 *   </div>
 */
function setupToggleSelect() {
  const toggleSelects = document.querySelectorAll('[data-toggle-select]');

  toggleSelects.forEach(select => {
    const targetSelector = select.getAttribute('data-toggle-select');
    const targetElement = document.querySelector(targetSelector);

    if (targetElement) {
      // Initialize on page load
      updateToggleVisibility(select, targetElement);

      // Update on change
      select.addEventListener('change', function() {
        updateToggleVisibility(this, targetElement);
      });
    }
  });
}

/**
 * Update toggle visibility based on select value
 */
function updateToggleVisibility(select, targetElement) {
  const selectedValue = select.value;
  const toggleElements = targetElement.querySelectorAll('[data-toggle-when]');

  toggleElements.forEach(el => {
    const whenValue = el.getAttribute('data-toggle-when');
    if (selectedValue === whenValue) {
      el.style.display = 'block';
      // Enable inputs in this element
      toggleFormElements(el, true);
    } else {
      el.style.display = 'none';
      // Disable inputs in this element
      toggleFormElements(el, false);
    }
  });
}

/**
 * Toggle form elements enabled/disabled state
 */
function toggleFormElements(element, enabled) {
  const inputs = element.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (enabled) {
      input.disabled = false;
    } else {
      input.disabled = true;
      input.value = '';
    }
  });
}

/**
 * Format currency for display
 */
function formatCurrency(value) {
  if (!value && value !== 0) return 'Rp 0';
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

/**
 * Format date to DD/MM/YYYY
 */
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse date from YYYY-MM-DD format
 */
function parseDate(dateString) {
  const [year, month, day] = dateString.split('-');
  return new Date(year, month - 1, day);
}

/**
 * Calculate Tipe Developer (I-IV)
 */
function hitungTipeDeveloper(legalitasTanah, kondisiBangunan) {
  if (!legalitasTanah || !kondisiBangunan) return null;

  if (legalitasTanah === 'Sertifikat Induk' && kondisiBangunan === 'Belum Selesai') {
    return 'Tipe I';
  }
  if (legalitasTanah === 'Sertifikat Induk' && (kondisiBangunan === 'Selesai' || kondisiBangunan === 'Sebagian Selesai')) {
    return 'Tipe II';
  }
  if (legalitasTanah === 'Sertifikat Pecahan' && kondisiBangunan === 'Belum Selesai') {
    return 'Tipe III';
  }
  if (legalitasTanah === 'Sertifikat Pecahan' && (kondisiBangunan === 'Selesai' || kondisiBangunan === 'Sebagian Selesai')) {
    return 'Tipe IV';
  }

  return null;
}

/**
 * Update Tipe Developer display when inputs change
 */
function setupTipeDeveloperCalculator() {
  const legalitasInput = document.getElementById('legalitas_tanah');
  const kondisiInput = document.getElementById('kondisi_bangunan');
  const tipeDeveloperDisplay = document.getElementById('tipe_developer_display');

  if (legalitasInput && kondisiInput && tipeDeveloperDisplay) {
    const updateDisplay = () => {
      const tipe = hitungTipeDeveloper(legalitasInput.value, kondisiInput.value);
      tipeDeveloperDisplay.textContent = tipe || '-';
    };

    legalitasInput.addEventListener('change', updateDisplay);
    kondisiInput.addEventListener('change', updateDisplay);
    updateDisplay();
  }
}

/**
 * Validate form before submission
 */
function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return true;

  const requiredFields = form.querySelectorAll('[required]');
  let valid = true;

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      field.classList.add('is-invalid');
      valid = false;
    } else {
      field.classList.remove('is-invalid');
    }
  });

  return valid;
}

/**
 * Show loading state on button
 */
function showLoadingButton(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    return originalText;
  }
}

/**
 * Hide loading state on button
 */
function hideLoadingButton(buttonId, originalText) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

/**
 * Handle file upload progress
 */
function setupFileUploadProgress() {
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', function() {
      if (this.files.length > 0) {
        const file = this.files[0];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (file.size > maxSize) {
          alert('Ukuran file terlalu besar. Maksimal 5MB.');
          this.value = '';
          return;
        }

        // Check file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
          alert('Tipe file tidak didukung. Gunakan PDF, JPG, atau PNG.');
          this.value = '';
          return;
        }
      }
    });
  });
}

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', function() {
  setupTipeDeveloperCalculator();
  setupFileUploadProgress();
});

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    hitungTipeDeveloper,
    formatCurrency,
    formatDate
  };
}
