// NOTE: This URL must be replaced with your deployed Google Apps Script Web App URL
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbytTjLwBjsF02oCylEpS279TVCw4pxmRg_6xygzb9jClirQHwJMBZW-HfLe1fD5QOh5/exec";
const form = document.getElementById("dataEntryForm");
const submitBtn = document.getElementById("submitBtn");
const todayReportBtn = document.getElementById("todayReportBtn");
const mealReportBtn = document.getElementById("mealReportBtn");
const todayReportContainer = document.getElementById("todayReportContainer");
const todayReportContent = document.getElementById("todayReportContent");
const mealReportContainer = document.getElementById("mealReportContainer");
const mealReportContent = document.getElementById("mealReportContent");
const messageBox = document.getElementById("messageBox");
const messageText = document.getElementById("messageText");
const nameSelect = document.getElementById("name");
const mealOptionsSelect = document.getElementById("mealOptions");
const nextDayMealOptionsSelect = document.getElementById("nextDayMealOptions");
const yearNameElement = document.getElementById("yearName");
const noticeTextElement = document.getElementById("noticeText");

// Helper function to handle the visibility of report containers
function toggleReportContainer(container, show) {
  if (show) {
    // Ensure we hide the other container when showing one
    if (container === todayReportContainer) {
      toggleReportContainer(mealReportContainer, false);
    } else if (container === mealReportContainer) {
      toggleReportContainer(todayReportContainer, false);
    }

    container.style.display = "block";
    setTimeout(() => {
      container.classList.add("show");
    }, 10);
  } else {
    container.classList.remove("show");
    // Wait for the transition to finish before setting display to none
    setTimeout(() => {
      container.style.display = "none";
    }, 600); // Should match transition-speed
  }
}

// Function to show a message (moved to bottom for better user focus)
function showMessage(text, isError = false) {
  // Clear any existing timeout to prevent overlap
  clearTimeout(window.messageTimeout);

  messageText.textContent = text;
  messageBox.className =
    "message-box show " +
    (isError ? "message-box-error" : "message-box-success");

  window.messageTimeout = setTimeout(() => {
    messageBox.classList.remove("show");
  }, 3500);
}

// Function to set loading state for buttons
function setButtonLoadingState(button, isLoading) {
  // Find the text and spinner based on class
  const buttonText = button.querySelector("span:not(.spinner-container)");
  const spinnerContainer = button.querySelector(".spinner-container");

  if (buttonText) {
    buttonText.style.display = isLoading ? "none" : "inline";
  }
  spinnerContainer.classList.toggle("show", isLoading);

  button.disabled = isLoading;
}

// Function to load initial data (names, meal options, year, and notice)
async function loadInitialData() {
  try {
    // Set a basic loading message for initial load
    showMessage("Loading initial configuration data...", false);

    const response = await fetch(`${SCRIPT_URL}?action=getInitialData`);
    const result = await response.json();
    // console.log("Initial Data Response:", result);
    if (result.status === "success") {
      // Populate names dropdown
      nameSelect.innerHTML =
        '<option value="" disabled selected>Select Your Name</option>';
      if (result.names) {
        result.names.forEach((name) => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          nameSelect.appendChild(option);
        });
      }
      // Populate today's meal dropdown
      mealOptionsSelect.innerHTML =
        '<option value="" disabled selected>Select Meal</option>';
      if (result.meals) {
        result.meals.forEach((meal) => {
          const option = document.createElement("option");
          option.value = meal;
          option.textContent = meal;
          mealOptionsSelect.appendChild(option);
        });
      }
      // Populate next day's meal dropdown
      nextDayMealOptionsSelect.innerHTML =
        '<option value="" disabled selected>Select Meal</option>';
      if (result.nextDayMeals) {
        result.nextDayMeals.forEach((meal) => {
          const option = document.createElement("option");
          option.value = meal;
          option.textContent = meal;
          nextDayMealOptionsSelect.appendChild(option);
        });
      }

      // Populate year and notice text
      if (result.yearName) {
        yearNameElement.textContent = result.yearName;
      }
      if (result.noticeText) {
        noticeTextElement.textContent = result.noticeText;
      }
      showMessage("Configuration loaded successfully. Ready for entry!", false);
    } else {
      showMessage(
        "Failed to load configuration data. Check the script URL or sheet.",
        true
      );
      console.error("Initial data loading failed:", result.message);
    }
  } catch (error) {
    showMessage(
      "Connection error. Please ensure the Google Apps Script is deployed and accessible.",
      true
    );
    console.error("Error during initial data loading:", error);
  }
}
// Load data on page load
document.addEventListener("DOMContentLoaded", loadInitialData);

// Form submission handler
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setButtonLoadingState(submitBtn, true);
  showMessage("Submitting data...", false);

  const formData = new FormData(form);
  const data = {};
  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }

  try {
    const maxRetries = 3;
    let response;
    for (let i = 0; i < maxRetries; i++) {
      try {
        response = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(data).toString(),
        });
        if (response.ok) break;
        if (i < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, i) * 1000)
          );
        }
      } catch (fetchError) {
        if (i < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, i) * 1000)
          );
        } else {
          throw fetchError;
        }
      }
    }

    if (!response || !response.ok) {
      throw new Error("API call failed after retries.");
    }

    const result = await response.json();
    console.log("Submission Response:", result);

    if (result.status === "success") {
      showMessage(
        "Entry saved! Thanks for updating your meal preference.",
        false
      );
      form.reset();
      // Optional: Re-fetch initial data to ensure dropdowns are reset/updated
      await loadInitialData();
    } else {
      showMessage(
        `Submission failed: ${
          result.message || "Unknown error. Check console."
        }`,
        true
      );
      console.error("Submission failed:", result.message);
    }
  } catch (error) {
    showMessage(
      "A critical error occurred. Check script URL or network.",
      true
    );
    console.error("Error during submission:", error);
  } finally {
    setButtonLoadingState(submitBtn, false);
  }
});

// Function to render report data
function renderReport(data, reportContainer, reportContent, reportType) {
  reportContent.innerHTML = "";
  if (data.length === 0) {
    reportContent.innerHTML = `<p style="text-align:center; color:#5f6368; padding:1.5rem; font-style:italic;">No entries found for this report.</p>`;
    toggleReportContainer(reportContainer, true);
    return;
  }

  const table = document.createElement("table");
  table.className = "report-table";

  // Determine headers based on report type
  let headers;
  if (reportType === "today") {
    headers = ["User", "Today's Meal", "Next Day's Meal"];
  } else {
    // 'meal' report
    headers = ["Name", "Given Taka", "Total Meal", "Status"];
  }

  // Table Header
  const thead = document.createElement("thead");
  thead.className = "report-table-header";
  const headerRow = thead.insertRow();
  headers.forEach((headerText) => {
    const th = document.createElement("th");
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  table.appendChild(thead);

  // Table Body
  const tbody = document.createElement("tbody");
  data.forEach((row) => {
    const tr = tbody.insertRow();
    tr.className = "report-table-row";

    row.forEach((cellData, index) => {
      const td = tr.insertCell();
      td.className = "report-table-cell";

      // Check if it's the 'Status' column in the meal report (index 3)
      if (reportType === "meal" && index === 3) {
        // Apply visual badge styling for the last column (Status/Enough)
        let badgeClass = "status-n_a";
        if (String(cellData).toLowerCase() === "yes") {
          badgeClass = "status-yes";
        } else if (String(cellData).toLowerCase() === "no") {
          badgeClass = "status-no";
        }

        td.innerHTML = `<span class="status-badge ${badgeClass}">${cellData}</span>`;
      } else {
        td.textContent = cellData;
      }
    });
  });
  table.appendChild(tbody);
  reportContent.appendChild(table);
  toggleReportContainer(reportContainer, true);
}

// Fetch today's entries
todayReportBtn.addEventListener("click", async () => {
  const button = todayReportBtn;

  // Toggle logic: If visible, hide it.
  const isVisible = todayReportContainer.classList.contains("show");
  if (isVisible) {
    toggleReportContainer(todayReportContainer, false);
    showMessage("Today's entries report closed.", false);
    return;
  }

  setButtonLoadingState(button, true);
  showMessage("Fetching today's entries...", false);

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getTodayEntries`);
    const data = await response.json();
    console.log("Today's Report Data:", data);

    if (data.status === "success") {
      renderReport(
        data.data,
        todayReportContainer,
        todayReportContent,
        "today"
      );
      showMessage(`Loaded ${data.data.length} entries for today.`, false);
    } else {
      renderReport([], todayReportContainer, todayReportContent, "today");
      showMessage("Daily data failed to load. Try again.", true);
      console.error("Daily data retrieval failed:", data.message);
    }
  } catch (error) {
    showMessage(
      "An error occurred. Check the script URL or network connection.",
      true
    );
    console.error("Error during data retrieval:", error);
  } finally {
    setButtonLoadingState(button, false);
  }
});

// Fetch meal reports
mealReportBtn.addEventListener("click", async () => {
  const button = mealReportBtn;

  // Toggle logic: If visible, hide it.
  const isVisible = mealReportContainer.classList.contains("show");
  if (isVisible) {
    toggleReportContainer(mealReportContainer, false);
    showMessage("Total mess report closed.", false);
    return;
  }

  setButtonLoadingState(button, true);
  showMessage("Generating total meal report...", false);

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getMealReports`);
    const data = await response.json();
    console.log("Meal Report Data:", data);

    if (data.status === "success") {
      renderReport(data.data, mealReportContainer, mealReportContent, "meal");
      showMessage(
        `Loaded ${data.data.length} user records for the total report.`,
        false
      );
    } else {
      renderReport([], mealReportContainer, mealReportContent, "meal");
      showMessage("Total meal report failed to load. Try again.", true);
      console.error("Data retrieval failed:", data.message);
    }
  } catch (error) {
    showMessage(
      "An error occurred. Check the script URL or network connection.",
      true
    );
    console.error("Error during data retrieval:", error);
  } finally {
    setButtonLoadingState(button, false);
  }
});
