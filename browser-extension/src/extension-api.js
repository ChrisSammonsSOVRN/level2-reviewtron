// src/extension-api.js
async function fetchAuditResults(url) {
    try {
      const response = await fetch(`http://localhost:5000/audit/url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      });
      if (!response.ok) throw new Error("Network response was not ok");
      return await response.json();
    } catch (error) {
      console.error("Error fetching audit results:", error);
      return null;
    }
  }
  
  export { fetchAuditResults };
  