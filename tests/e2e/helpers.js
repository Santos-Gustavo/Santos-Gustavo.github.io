function failOnConsoleErrors(page) {
  page.on("console", msg => {
    const text = msg.text();

    // Supabase/PostgREST 400s are often followed by a better app-level console.error.
    // Do not fail immediately on this generic browser message.
    if (
      msg.type() === "error" &&
      text.includes("Failed to load resource") &&
      text.includes("400")
    ) {
      console.warn("Ignored generic 400 resource error:", text);
      return;
    }

    if (msg.type() === "error") {
      throw new Error(`Browser console error: ${text}`);
    }
  });

  page.on("pageerror", error => {
    throw new Error(`Browser page error: ${error.message}`);
  });
}

module.exports = { failOnConsoleErrors };